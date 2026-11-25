// F-05 application layer: deliverable submissions (Prisma). BR-10/BR-11 and ownership are enforced here, never in the UI.
import { prisma } from '../db.js';
import { ApiError } from '../errors.js';
import { canSubmit, currentVersion, isLate } from './rules.js';

export const submissionSelect = {
  id: true,
  milestoneId: true,
  teamId: true,
  version: true,
  url: true,
  note: true,
  isLate: true,
  submittedAt: true,
  submittedBy: { select: { id: true, displayName: true } },
};

const forbidden = (message) => new ApiError(403, 'FORBIDDEN', message);
const milestoneSelect = { id: true, courseId: true, title: true, description: true, dueAt: true, weight: true, maxScore: true };

async function loadMilestone(id) {
  const m = await prisma.milestone.findUnique({ where: { id }, select: { ...milestoneSelect, course: { select: { instructorId: true } } } });
  if (!m) throw new ApiError(404, 'NOT_FOUND', 'Milestone not found');
  const { course, ...milestone } = m;
  return { milestone, instructorId: course.instructorId };
}

/** S6: the student must be enrolled in the milestone's course (403); returns their team in it or null. */
async function studentTeam(courseId, user) {
  const enrolled = await prisma.enrollment.findUnique({ where: { courseId_userId: { courseId, userId: user.id } } });
  if (!enrolled) throw forbidden('You are not enrolled in this course');
  const membership = await prisma.teamMember.findUnique({
    where: { courseId_userId: { courseId, userId: user.id } },
    select: { team: { select: { id: true, name: true } } },
  });
  return membership?.team ?? null;
}

// FR-15 / FR-16: submit a new version for the student's own team.
export async function submitDeliverable(milestoneId, user, input, now = new Date()) {
  const { milestone } = await loadMilestone(milestoneId);
  const team = await studentTeam(milestone.courseId, user);
  if (!team) throw new ApiError(409, 'NO_TEAM', 'Join or create a team before submitting');

  const approved = await prisma.proposal.findFirst({ where: { teamId: team.id, status: 'APPROVED' }, select: { id: true } });
  if (!approved) throw new ApiError(409, 'PROPOSAL_NOT_APPROVED', 'Your proposal must be approved before you can submit');

  // S4 / F-06 G8: one transaction that locks the team row, so versions are numbered without gaps or duplicates and
  // grading/release of the same team cannot interleave with a new submission.
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Team" WHERE id = ${team.id} FOR UPDATE`;
    const versions = await tx.submission.findMany({
      where: { milestoneId, teamId: team.id },
      select: { version: true, isLate: true },
    });
    // S5 (released grade → 409 GRADE_RELEASED) is added by F-06 here, after BR-10 and before S3.
    const check = canSubmit({ versions, dueAt: milestone.dueAt, now });
    if (!check.ok) {
      throw new ApiError(409, check.code, 'The due date has passed and your team already has an on-time version');
    }
    const next = (currentVersion(versions)?.version ?? 0) + 1;
    return tx.submission.create({
      data: {
        milestoneId,
        teamId: team.id,
        version: next,
        url: input.url,
        note: input.note,
        isLate: isLate(milestone.dueAt, now),
        submittedById: user.id,
        submittedAt: now,
      },
      select: submissionSelect,
    });
  });
}

// FR-16 / FR-14: students see their own team's versions; the course instructor sees every team.
export async function listSubmissions(milestoneId, user) {
  const { milestone, instructorId } = await loadMilestone(milestoneId);

  if (user.role === 'INSTRUCTOR') {
    if (instructorId !== user.id) throw forbidden('You do not teach this course');
    const teams = await prisma.team.findMany({
      where: { courseId: milestone.courseId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        submissions: { where: { milestoneId }, orderBy: { version: 'desc' }, select: submissionSelect },
      },
    });
    return {
      milestone,
      teams: teams.map((t) => ({ team: { id: t.id, name: t.name }, current: t.submissions[0] ?? null, versionCount: t.submissions.length })),
    };
  }

  const team = await studentTeam(milestone.courseId, user);
  const versions = team
    ? await prisma.submission.findMany({ where: { milestoneId, teamId: team.id }, orderBy: { version: 'desc' }, select: submissionSelect })
    : [];
  return { milestone, team, current: versions[0] ?? null, versions };
}

/** S7: current version per milestone for one team, used by the F-04 milestone list. */
export async function currentByMilestone(teamId, milestoneIds) {
  const rows = await prisma.submission.findMany({
    where: { teamId, milestoneId: { in: milestoneIds } },
    select: { milestoneId: true, version: true, isLate: true },
  });
  const byMilestone = new Map();
  for (const r of rows) {
    const cur = byMilestone.get(r.milestoneId);
    if (!cur || r.version > cur.version) byMilestone.set(r.milestoneId, r);
  }
  return byMilestone;
}
