// F-02 application layer: database work for proposals (Prisma).
// Ownership (BR-05) and state rules (BR-01..BR-04) are enforced here, never in the UI.
import { prisma } from '../db.js';
import { ApiError } from '../errors.js';
import { ACTIVE_STATUSES, canTransition, isBeforeDeadline } from './rules.js';

const proposalSelect = {
  id: true,
  teamId: true,
  title: true,
  description: true,
  status: true,
  rejectReason: true,
  submittedAt: true,
  decidedAt: true,
  decidedBy: { select: { id: true, displayName: true } },
  createdAt: true,
  updatedAt: true,
};

const forbidden = (message = 'You do not have permission for this action') => new ApiError(403, 'FORBIDDEN', message);
const notFound = (what) => new ApiError(404, 'NOT_FOUND', `${what} not found`);
const invalidTransition = (from, to) =>
  new ApiError(409, 'INVALID_TRANSITION', `A ${from} proposal cannot be ${to}`, { status: from });

async function isMember(db, teamId, userId) {
  return Boolean(await db.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } } }));
}

/** Load a proposal with its team and course, or throw 404. */
async function loadProposal(id) {
  const p = await prisma.proposal.findUnique({
    where: { id },
    select: { id: true, status: true, team: { select: { id: true, name: true, course: { select: { id: true, code: true, instructorId: true, proposalDeadline: true } } } } },
  });
  if (!p) throw notFound('Proposal');
  return p;
}

const findProposal = (id) => prisma.proposal.findUnique({ where: { id }, select: proposalSelect });

/** BR-05 for student actions: the current user must be a member of the proposal's team. */
async function loadForMember(id, user) {
  const p = await loadProposal(id);
  if (!(await isMember(prisma, p.team.id, user.id))) throw forbidden('You are not a member of this team');
  return p;
}

/** BR-05 for instructor actions: the current user must teach the proposal's course. */
async function loadForCourseInstructor(id, user) {
  const p = await loadProposal(id);
  if (p.team.course.instructorId !== user.id) throw forbidden('You do not teach this course');
  return p;
}

// FR-05, BR-01: create a DRAFT. The team row is locked so concurrent creates are serialised.
export async function createProposal(teamId, user, { title, description }) {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw`SELECT id FROM "Team" WHERE id = ${teamId} FOR UPDATE`;
    if (locked.length === 0) throw notFound('Team');
    if (!(await isMember(tx, teamId, user.id))) throw forbidden('You are not a member of this team');

    const active = await tx.proposal.findFirst({ where: { teamId, status: { in: ACTIVE_STATUSES } }, select: { id: true, status: true } });
    if (active) {
      throw new ApiError(409, 'ACTIVE_PROPOSAL_EXISTS', 'Your team already has an active proposal', {
        proposalId: active.id,
        status: active.status,
      });
    }
    return tx.proposal.create({ data: { teamId, title, description }, select: proposalSelect });
  });
}

// FR-05: edit text while DRAFT only (conditional update — no lost update after a submit).
export async function updateDraft(id, user, changes) {
  const p = await loadForMember(id, user);
  const { count } = await prisma.proposal.updateMany({ where: { id, status: 'DRAFT' }, data: changes });
  if (count === 0) throw new ApiError(409, 'INVALID_TRANSITION', `A ${p.status} proposal can no longer be edited`, { status: p.status });
  return findProposal(id);
}

// FR-06, BR-02, BR-03: DRAFT → SUBMITTED before the course deadline.
export async function submitProposal(id, user, now = new Date()) {
  const p = await loadForMember(id, user);
  if (!canTransition(p.status, 'SUBMITTED')) throw invalidTransition(p.status, 'SUBMITTED');
  if (!isBeforeDeadline(p.team.course.proposalDeadline, now)) {
    throw new ApiError(409, 'DEADLINE_PASSED', 'The proposal deadline has passed', {
      proposalDeadline: p.team.course.proposalDeadline.toISOString(),
    });
  }
  const { count } = await prisma.proposal.updateMany({
    where: { id, status: 'DRAFT' },
    data: { status: 'SUBMITTED', submittedAt: now },
  });
  if (count === 0) throw invalidTransition((await loadProposal(id)).status, 'SUBMITTED');
  return findProposal(id);
}

// FR-08, BR-03, BR-04: SUBMITTED → APPROVED | REJECTED by the course instructor.
export async function decideProposal(id, user, to, reason = null, now = new Date()) {
  const p = await loadForCourseInstructor(id, user);
  if (!canTransition(p.status, to)) throw invalidTransition(p.status, to);
  const { count } = await prisma.proposal.updateMany({
    where: { id, status: 'SUBMITTED' },
    data: { status: to, decidedAt: now, decidedById: user.id, rejectReason: to === 'REJECTED' ? reason : null },
  });
  if (count === 0) throw invalidTransition((await loadProposal(id)).status, to);
  return findProposal(id);
}

// FR-09 / FR-07: one proposal, for a team member or the course instructor.
export async function getProposal(id, user) {
  const p = await loadProposal(id);
  const allowed = p.team.course.instructorId === user.id || (await isMember(prisma, p.team.id, user.id));
  if (!allowed) throw forbidden('You do not have access to this proposal');
  return {
    proposal: await findProposal(id),
    team: { id: p.team.id, name: p.team.name },
    course: { id: p.team.course.id, code: p.team.course.code },
  };
}

async function loadCourse(courseId) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, code: true, name: true, proposalDeadline: true, instructorId: true },
  });
  if (!course) throw notFound('Course');
  return course;
}

const publicCourse = ({ instructorId, ...c }) => c; // eslint-disable-line no-unused-vars

// FR-07: all proposals of a course the instructor teaches, optionally filtered by status.
export async function listCourseProposals(courseId, user, status) {
  const course = await loadCourse(courseId);
  if (course.instructorId !== user.id) throw forbidden('You do not have access to this course');
  const proposals = await prisma.proposal.findMany({
    where: { team: { courseId }, ...(status ? { status } : {}) },
    select: { ...proposalSelect, team: { select: { id: true, name: true } } },
    orderBy: [{ team: { name: 'asc' } }, { createdAt: 'desc' }, { id: 'desc' }],
  });
  return { course: publicCourse(course), proposals };
}

// FR-09: the student's own team in a course, with all its proposals (newest first).
export async function getMyTeam(courseId, user) {
  const course = await loadCourse(courseId);
  const team = await prisma.team.findFirst({
    where: { courseId, members: { some: { userId: user.id } } },
    select: {
      id: true,
      name: true,
      members: { select: { user: { select: { id: true, displayName: true } } }, orderBy: { userId: 'asc' } },
      proposals: { select: proposalSelect, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] },
    },
  });
  if (!team) throw new ApiError(404, 'NOT_FOUND', 'You are not in a team for this course');
  return {
    course: publicCourse(course),
    team: { id: team.id, name: team.name, members: team.members.map((m) => m.user) },
    proposals: team.proposals,
  };
}
