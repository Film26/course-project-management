// F-03 application layer: team formation (Prisma). BR-06/07/08 and enrollment (T1) are enforced here, never in the UI.
import { prisma } from '../db.js';
import { ApiError } from '../errors.js';
import { canJoin, isMembershipLocked } from './rules.js';

const forbidden = (message) => new ApiError(403, 'FORBIDDEN', message);
const notFound = (what) => new ApiError(404, 'NOT_FOUND', `${what} not found`);
const alreadyInTeam = () => new ApiError(409, 'ALREADY_IN_TEAM', 'You already have a team in this course');
const locked = () => new ApiError(409, 'MEMBERSHIP_LOCKED', 'Team membership is locked because the proposal is approved');

const teamSelect = {
  id: true,
  name: true,
  courseId: true,
  joinCode: true,
  members: { select: { user: { select: { id: true, displayName: true } } }, orderBy: { userId: 'asc' } },
  proposals: { select: { status: true } },
};

/** Response shape T: the proposals are only used for `locked` and are not returned. */
export function toTeam(t) {
  return {
    id: t.id,
    name: t.name,
    courseId: t.courseId,
    joinCode: t.joinCode,
    members: t.members.map((m) => m.user),
    memberCount: t.members.length,
    locked: isMembershipLocked(t.proposals.map((p) => p.status)),
  };
}

/** T1: the course must exist (404) and the student must be enrolled in it (403). */
async function requireEnrolled(db, courseId, user) {
  const course = await db.course.findUnique({ where: { id: courseId }, select: { id: true, maxTeamSize: true } });
  if (!course) throw notFound('Course');
  const enrolled = await db.enrollment.findUnique({ where: { courseId_userId: { courseId, userId: user.id } } });
  if (!enrolled) throw forbidden('You are not enrolled in this course');
  return course;
}

const isUniqueViolation = (err, field) => err?.code === 'P2002' && String(err.meta?.target ?? '').includes(field);

// FR-10: create a team; the creator becomes its only member. BR-06 is also a DB unique constraint (race → 409).
export async function createTeam(courseId, user, { name }) {
  await requireEnrolled(prisma, courseId, user);
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.teamMember.findUnique({ where: { courseId_userId: { courseId, userId: user.id } } });
      if (existing) throw alreadyInTeam();
      const team = await tx.team.create({
        data: { name, courseId, members: { create: { userId: user.id, courseId } } },
        select: teamSelect,
      });
      return toTeam(team);
    });
  } catch (err) {
    if (isUniqueViolation(err, 'name')) throw new ApiError(409, 'TEAM_NAME_TAKEN', 'A team with this name already exists in this course');
    if (isUniqueViolation(err, 'userId')) throw alreadyInTeam();
    // T7: a join-code collision is astronomically unlikely; retrying is left to the client (409 is safe).
    if (isUniqueViolation(err, 'joinCode')) throw new ApiError(409, 'TRY_AGAIN', 'Please try again');
    throw err;
  }
}

// FR-11: join by code. The team row is locked so two joins for the last place run one after the other (BR-07).
export async function joinTeam(courseId, user, joinCode) {
  const course = await requireEnrolled(prisma, courseId, user);
  try {
    return await prisma.$transaction(async (tx) => {
      const found = await tx.team.findFirst({ where: { courseId, joinCode }, select: { id: true } });
      if (!found) throw notFound('Team with this code in this course');
      // The team may have been deleted (last member left, T6) between the look-up and the lock → 404, not 500.
      const lockedRows = await tx.$queryRaw`SELECT id FROM "Team" WHERE id = ${found.id} FOR UPDATE`;
      if (lockedRows.length === 0) throw notFound('Team with this code in this course');

      if (await tx.teamMember.findUnique({ where: { courseId_userId: { courseId, userId: user.id } } })) throw alreadyInTeam();
      const team = await tx.team.findUnique({ where: { id: found.id }, select: teamSelect });
      if (isMembershipLocked(team.proposals.map((p) => p.status))) throw locked();
      if (!canJoin(team.members.length, course.maxTeamSize)) {
        throw new ApiError(409, 'TEAM_FULL', `This team already has ${course.maxTeamSize} members`, { maxTeamSize: course.maxTeamSize });
      }
      await tx.teamMember.create({ data: { teamId: team.id, userId: user.id, courseId } });
      return toTeam(await tx.team.findUnique({ where: { id: team.id }, select: teamSelect }));
    });
  } catch (err) {
    if (isUniqueViolation(err, 'userId')) throw alreadyInTeam(); // BR-06 race between two joins of the same student
    throw err;
  }
}

// FR-12: leave. BR-08 lock; T6: the last member leaving deletes a team without proposals, keeps one with proposals.
export async function leaveTeam(teamId, user) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`SELECT id FROM "Team" WHERE id = ${teamId} FOR UPDATE`;
    if (rows.length === 0) throw notFound('Team');
    const team = await tx.team.findUnique({ where: { id: teamId }, select: teamSelect });
    if (!team.members.some((m) => m.user.id === user.id)) throw forbidden('You are not a member of this team');
    if (isMembershipLocked(team.proposals.map((p) => p.status))) throw locked();

    await tx.teamMember.delete({ where: { teamId_userId: { teamId, userId: user.id } } });
    const teamDeleted = team.members.length === 1 && team.proposals.length === 0;
    if (teamDeleted) await tx.team.delete({ where: { id: teamId } });
    return { left: true, teamDeleted };
  });
}
