// F-04 application layer: database work for milestones (Prisma).
// Ownership (M5) and the weight total (BR-09, M1) are enforced here, never in the UI.
import { prisma } from '../db.js';
import { ApiError } from '../errors.js';
import { LIMITS, checkWeightTotal } from './rules.js';
import { teamStatus } from '../submissions/rules.js';
import { currentByMilestone } from '../submissions/service.js';
import { highestScore } from '../grades/service.js';

const milestoneSelect = {
  id: true,
  courseId: true,
  title: true,
  description: true,
  dueAt: true,
  weight: true,
  maxScore: true,
  createdAt: true,
  updatedAt: true,
};

const forbidden = (message) => new ApiError(403, 'FORBIDDEN', message);
const notFound = (what) => new ApiError(404, 'NOT_FOUND', `${what} not found`);
const order = [{ dueAt: 'asc' }, { id: 'asc' }]; // M7

/**
 * M1 (call inside a transaction after lockCourse, so concurrent creates/edits of a course run one after another):
 * the other milestones plus the new weight must stay within 100 %.
 */
async function checkWeightWithinLimit(tx, courseId, weight, excludeId) {
  const otherTotal = await tx.milestone.aggregate({
    where: { courseId, ...(excludeId ? { id: { not: excludeId } } : {}) },
    _sum: { weight: true },
  });
  const check = checkWeightTotal(otherTotal._sum.weight ?? 0, weight);
  if (!check.ok) {
    throw new ApiError(409, 'WEIGHT_EXCEEDED', `Total weight would be ${check.currentTotal + weight} % (max ${LIMITS.maxWeightTotal} %)`, {
      currentTotal: check.currentTotal,
      requested: weight,
      max: LIMITS.maxWeightTotal,
    });
  }
}

async function lockCourse(tx, courseId) {
  const rows = await tx.$queryRaw`SELECT id, "instructorId" FROM "Course" WHERE id = ${courseId} FOR UPDATE`;
  if (rows.length === 0) throw notFound('Course');
  return rows[0];
}

/**
 * Inside a transaction: lock the milestone row, or 404; then require the course instructor (403). A concurrent
 * edit/delete of the same milestone waits for the lock and then sees the result (404 if it was deleted), so the
 * write after it can no longer fail with Prisma P2025 (PR #48 review).
 */
async function lockForInstructor(tx, id, user) {
  const rows = await tx.$queryRaw`SELECT m.id, m."courseId", c."instructorId"
    FROM "Milestone" m JOIN "Course" c ON c.id = m."courseId" WHERE m.id = ${id} FOR UPDATE OF m`;
  if (rows.length === 0) throw notFound('Milestone');
  if (rows[0].instructorId !== user.id) throw forbidden('You do not teach this course');
  return rows[0];
}

/** Any remaining "record not found" from Prisma is a 404, never a 500 (NFR-05). */
function mapNotFound(err) {
  if (err?.code === 'P2025') return notFound('Milestone');
  return err;
}

// FR-13: create, BR-09 checked under the course lock.
export async function createMilestone(courseId, user, input) {
  return prisma.$transaction(async (tx) => {
    const course = await lockCourse(tx, courseId);
    if (course.instructorId !== user.id) throw forbidden('You do not teach this course');
    await checkWeightWithinLimit(tx, courseId, input.weight);
    return tx.milestone.create({ data: { ...input, courseId }, select: milestoneSelect });
  });
}

// FR-13: edit only the sent fields; a new weight is checked without counting the milestone's old weight.
export async function updateMilestone(id, user, changes) {
  try {
    return await prisma.$transaction(async (tx) => {
      const m = await lockForInstructor(tx, id, user);
      if (changes.weight !== undefined) {
        await lockCourse(tx, m.courseId);
        await checkWeightWithinLimit(tx, m.courseId, changes.weight, id);
      }
      // F-06 G6: maxScore cannot drop below a score that was already given on this milestone.
      if (changes.maxScore !== undefined) {
        const top = await highestScore(tx, id);
        if (top !== null && changes.maxScore < top) {
          throw new ApiError(409, 'SCORE_ABOVE_MAX', `A grade of ${top} already exists on this milestone`, { highestScore: top });
        }
      }
      return tx.milestone.update({ where: { id }, data: changes, select: milestoneSelect });
    });
  } catch (err) {
    throw mapNotFound(err);
  }
}

// FR-13 / M4: delete. Once F-05 adds submissions, the FK (ON DELETE RESTRICT) makes this a 409.
export async function deleteMilestone(id, user) {
  try {
    await prisma.$transaction(async (tx) => {
      await lockForInstructor(tx, id, user);
      await tx.milestone.delete({ where: { id } });
    });
  } catch (err) {
    if (err.code === 'P2003') {
      throw new ApiError(409, 'MILESTONE_HAS_SUBMISSIONS', 'This milestone already has submissions and cannot be deleted');
    }
    throw mapNotFound(err);
  }
}

// FR-13 (instructor) and FR-14 (student) list.
export async function listMilestones(courseId, user) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, code: true, name: true, instructorId: true },
  });
  if (!course) throw notFound('Course');

  let team = null;
  if (user.role === 'INSTRUCTOR') {
    if (course.instructorId !== user.id) throw forbidden('You do not have access to this course');
  } else {
    // M5 with F-03: a student must be enrolled in the course (403 otherwise); a team is optional (NO_TEAM).
    const enrolled = await prisma.enrollment.findUnique({ where: { courseId_userId: { courseId, userId: user.id } } });
    if (!enrolled) throw forbidden('You do not have access to this course');
    const membership = await prisma.teamMember.findUnique({
      where: { courseId_userId: { courseId, userId: user.id } },
      select: { team: { select: { id: true, name: true } } },
    });
    team = membership?.team ?? null;
  }

  const milestones = await prisma.milestone.findMany({ where: { courseId }, orderBy: order, select: milestoneSelect });
  const totalWeight = milestones.reduce((sum, m) => sum + m.weight, 0);
  const publicCourse = { id: course.id, code: course.code, name: course.name };

  if (user.role === 'INSTRUCTOR') return { course: publicCourse, milestones, totalWeight };
  // M6 / F-05 S7: SUBMITTED / LATE / NOT_SUBMITTED from the team's current version; NO_TEAM without a team.
  const current = team ? await currentByMilestone(team.id, milestones.map((m) => m.id)) : new Map();
  return {
    course: publicCourse,
    team,
    totalWeight,
    milestones: milestones.map((m) => ({ ...m, teamStatus: team ? teamStatus(current.get(m.id) ?? null) : 'NO_TEAM' })),
  };
}
