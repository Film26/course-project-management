// F-04 application layer: database work for milestones (Prisma).
// Ownership (M5) and the weight total (BR-09, M1) are enforced here, never in the UI.
import { prisma } from '../db.js';
import { ApiError } from '../errors.js';
import { LIMITS, checkWeightTotal } from './rules.js';

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

/** Load a milestone with its course owner, or 404; then require the course instructor (403). */
async function loadForInstructor(id, user) {
  const m = await prisma.milestone.findUnique({ where: { id }, select: { id: true, courseId: true, course: { select: { instructorId: true } } } });
  if (!m) throw notFound('Milestone');
  if (m.course.instructorId !== user.id) throw forbidden('You do not teach this course');
  return m;
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
  const m = await loadForInstructor(id, user);
  return prisma.$transaction(async (tx) => {
    if (changes.weight !== undefined) {
      await lockCourse(tx, m.courseId);
      await checkWeightWithinLimit(tx, m.courseId, changes.weight, id);
    }
    return tx.milestone.update({ where: { id }, data: changes, select: milestoneSelect });
  });
}

// FR-13 / M4: delete. Once F-05 adds submissions, the FK (ON DELETE RESTRICT) makes this a 409.
export async function deleteMilestone(id, user) {
  await loadForInstructor(id, user);
  try {
    await prisma.milestone.delete({ where: { id } });
  } catch (err) {
    if (err.code === 'P2003') {
      throw new ApiError(409, 'MILESTONE_HAS_SUBMISSIONS', 'This milestone already has submissions and cannot be deleted');
    }
    throw err;
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
    // Until F-03 adds Enrollment, a student belongs to a course through a team in it (F-01 rule).
    const membership = await prisma.teamMember.findFirst({
      where: { userId: user.id, team: { courseId } },
      select: { team: { select: { id: true, name: true } } },
    });
    if (!membership) throw forbidden('You do not have access to this course');
    team = membership.team;
  }

  const milestones = await prisma.milestone.findMany({ where: { courseId }, orderBy: order, select: milestoneSelect });
  const totalWeight = milestones.reduce((sum, m) => sum + m.weight, 0);
  const publicCourse = { id: course.id, code: course.code, name: course.name };

  if (user.role === 'INSTRUCTOR') return { course: publicCourse, milestones, totalWeight };
  // M6: F-05 replaces NOT_SUBMITTED with SUBMITTED / LATE from the team's current submission.
  return {
    course: publicCourse,
    team,
    totalWeight,
    milestones: milestones.map((m) => ({ ...m, teamStatus: team ? 'NOT_SUBMITTED' : 'NO_TEAM' })),
  };
}
