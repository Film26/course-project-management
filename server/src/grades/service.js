// F-06 application layer: grading and release (Prisma). D-08 and BR-12 are enforced here, never in the UI.
import { prisma } from '../db.js';
import { ApiError } from '../errors.js';
import { canGrade, canRelease, checkScoreRange } from './rules.js';

const MESSAGES = {
  GRADE_RELEASED: 'This grade has been released and can no longer be changed',
  NOT_CURRENT_VERSION: 'Only the team\'s current version can be graded or released',
  NOT_GRADED: 'Save a grade before releasing it',
  BEFORE_DUE: 'A grade can be released only after the milestone due date',
};
const conflict = (code) => new ApiError(409, code, MESSAGES[code]);

const gradeSelect = {
  id: true,
  submissionId: true,
  score: true,
  feedback: true,
  gradedAt: true,
  releasedAt: true,
  gradedBy: { select: { id: true, displayName: true } },
};
export const toGrade = (g, maxScore) => (g ? { ...g, maxScore } : null);

/** Load the submission with its milestone and course owner (404), then require the course instructor (403). */
async function loadForInstructor(submissionId, user) {
  const s = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      teamId: true,
      version: true,
      milestoneId: true,
      milestone: { select: { maxScore: true, dueAt: true, course: { select: { instructorId: true } } } },
    },
  });
  if (!s) throw new ApiError(404, 'NOT_FOUND', 'Submission not found');
  if (s.milestone.course.instructorId !== user.id) throw new ApiError(403, 'FORBIDDEN', 'You do not teach this course');
  return s;
}

/** G8: lock the team row (the same lock F-05 submit takes), then read whether this submission is still current. */
async function lockAndCheckCurrent(tx, s) {
  await tx.$queryRaw`SELECT id FROM "Team" WHERE id = ${s.teamId} FOR UPDATE`;
  const newest = await tx.submission.findFirst({
    where: { milestoneId: s.milestoneId, teamId: s.teamId },
    orderBy: { version: 'desc' },
    select: { id: true },
  });
  return newest?.id === s.id;
}

// FR-17: create or change the grade of the current version while it is unreleased.
export async function saveGrade(submissionId, user, { score, feedback }, now = new Date()) {
  const s = await loadForInstructor(submissionId, user);
  const range = checkScoreRange(score, s.milestone.maxScore);
  if (!range.ok) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid input', range.details);

  return prisma.$transaction(async (tx) => {
    const isCurrent = await lockAndCheckCurrent(tx, s);
    const existing = await tx.grade.findUnique({ where: { submissionId }, select: { id: true, releasedAt: true } });
    const check = canGrade({ isCurrent, releasedAt: existing?.releasedAt ?? null });
    if (!check.ok) throw conflict(check.code);

    const data = { score, feedback, gradedById: user.id, gradedAt: now };
    if (existing) {
      // G8: conditional write, never changes a released grade.
      const { count } = await tx.grade.updateMany({ where: { submissionId, releasedAt: null }, data });
      if (count === 0) throw conflict('GRADE_RELEASED');
    } else {
      await tx.grade.create({ data: { ...data, submissionId } });
    }
    return toGrade(await tx.grade.findUnique({ where: { submissionId }, select: gradeSelect }), s.milestone.maxScore);
  });
}

// FR-17 / D-08: release the grade of the current version after the due date; release is final.
export async function releaseGrade(submissionId, user, now = new Date()) {
  const s = await loadForInstructor(submissionId, user);
  return prisma.$transaction(async (tx) => {
    const isCurrent = await lockAndCheckCurrent(tx, s);
    const grade = await tx.grade.findUnique({ where: { submissionId }, select: { releasedAt: true } });
    const check = canRelease({ grade, isCurrent, dueAt: s.milestone.dueAt, now });
    if (!check.ok) throw conflict(check.code);
    const { count } = await tx.grade.updateMany({ where: { submissionId, releasedAt: null }, data: { releasedAt: now } });
    if (count === 0) throw conflict('GRADE_RELEASED');
    return toGrade(await tx.grade.findUnique({ where: { submissionId }, select: gradeSelect }), s.milestone.maxScore);
  });
}

// FR-18 / G4: released grades of the student's own team.
export async function myGrades(courseId, user) {
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, code: true, name: true } });
  if (!course) throw new ApiError(404, 'NOT_FOUND', 'Course not found');
  const enrolled = await prisma.enrollment.findUnique({ where: { courseId_userId: { courseId, userId: user.id } } });
  if (!enrolled) throw new ApiError(403, 'FORBIDDEN', 'You are not enrolled in this course');
  const membership = await prisma.teamMember.findUnique({
    where: { courseId_userId: { courseId, userId: user.id } },
    select: { team: { select: { id: true, name: true } } },
  });
  if (!membership) throw new ApiError(409, 'NO_TEAM', 'You are not in a team for this course');

  const grades = await prisma.grade.findMany({
    where: { releasedAt: { not: null }, submission: { teamId: membership.team.id, milestone: { courseId } } },
    select: {
      score: true,
      feedback: true,
      releasedAt: true,
      submission: { select: { version: true, milestone: { select: { id: true, title: true, weight: true, maxScore: true, dueAt: true } } } },
    },
  });
  grades.sort((a, b) => a.submission.milestone.dueAt - b.submission.milestone.dueAt);
  return {
    course,
    team: membership.team,
    grades: grades.map((g) => {
      const { dueAt, ...milestone } = g.submission.milestone; // eslint-disable-line no-unused-vars
      return { milestone, version: g.submission.version, score: g.score, feedback: g.feedback, releasedAt: g.releasedAt };
    }),
  };
}

/** F-04 G6: the highest score already given on a milestone (null if none). */
export async function highestScore(tx, milestoneId) {
  const r = await tx.grade.aggregate({ where: { submission: { milestoneId } }, _max: { score: true } });
  return r._max.score;
}

/** F-05 S5: does the team have a released grade on this milestone? */
export async function hasReleasedGrade(tx, milestoneId, teamId) {
  return Boolean(await tx.grade.findFirst({ where: { releasedAt: { not: null }, submission: { milestoneId, teamId } }, select: { id: true } }));
}

export { gradeSelect };
