// F-07 application layer: peer ratings (Prisma). BR-13 and ownership are enforced here, never in the UI.
import { prisma } from '../db.js';
import { ApiError } from '../errors.js';
import { averageOf } from './rules.js';

const MESSAGES = {
  NO_TEAM: 'Join or create a team before rating teammates',
  SELF_RATING: 'You cannot rate yourself',
  NOT_A_TEAMMATE: 'You can only rate current members of your team',
  ALREADY_RATED: 'You have already rated this teammate for this milestone',
};
const conflict = (code) => new ApiError(409, code, MESSAGES[code]);
const byName = (a, b) => a.displayName.localeCompare(b.displayName) || a.id - b.id;

async function loadMilestone(id) {
  const m = await prisma.milestone.findUnique({ where: { id }, select: { id: true, title: true, dueAt: true, courseId: true } });
  if (!m) throw new ApiError(404, 'NOT_FOUND', 'Milestone not found');
  return m;
}

/** E5: the student must be enrolled in the course (403) and in a team there (409 NO_TEAM). */
async function raterTeam(courseId, user) {
  const enrolled = await prisma.enrollment.findUnique({ where: { courseId_userId: { courseId, userId: user.id } } });
  if (!enrolled) throw new ApiError(403, 'FORBIDDEN', 'You are not enrolled in this course');
  const membership = await prisma.teamMember.findUnique({ where: { courseId_userId: { courseId, userId: user.id } }, select: { teamId: true } });
  if (!membership) throw conflict('NO_TEAM');
  return membership.teamId;
}

// FR-19: rate one current teammate once per milestone (E1–E3).
export async function rateTeammate(milestoneId, user, { rateeId, score, comment }) {
  const milestone = await loadMilestone(milestoneId);
  const teamId = await raterTeam(milestone.courseId, user);
  if (rateeId === user.id) throw conflict('SELF_RATING');
  // E2: same answer for another team, a former member and an unknown id, so the API does not reveal who exists.
  const teammate = await prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId: rateeId } }, select: { userId: true } });
  if (!teammate) throw conflict('NOT_A_TEAMMATE');
  try {
    return await prisma.peerRating.create({
      data: { milestoneId, teamId, raterId: user.id, rateeId, score, comment },
      select: { id: true, milestoneId: true, score: true, comment: true, createdAt: true, ratee: { select: { id: true, displayName: true } } },
    });
  } catch (err) {
    // E3: the unique (milestone, rater, ratee) index decides, also for two concurrent first ratings.
    if (err?.code === 'P2002') throw conflict('ALREADY_RATED');
    throw err;
  }
}

// BR-13 (E4): the student's teammates with only the ratings the student gave.
export async function myRatings(milestoneId, user) {
  const milestone = await loadMilestone(milestoneId);
  const teamId = await raterTeam(milestone.courseId, user);
  const [members, given] = await Promise.all([
    prisma.teamMember.findMany({ where: { teamId, userId: { not: user.id } }, select: { user: { select: { id: true, displayName: true } } } }),
    prisma.peerRating.findMany({ where: { milestoneId, raterId: user.id }, select: { rateeId: true, score: true, comment: true } }),
  ]);
  const mine = new Map(given.map((g) => [g.rateeId, { score: g.score, comment: g.comment }]));
  return {
    milestone: { id: milestone.id, title: milestone.title, dueAt: milestone.dueAt },
    teammates: members
      .map((m) => m.user)
      .sort(byName)
      .map((u) => ({ id: u.id, displayName: u.displayName, rated: mine.has(u.id), myRating: mine.get(u.id) ?? null })),
  };
}

// FR-20: per-student averages for the course instructor; comments without rater names (E4, E6).
export async function courseSummary(courseId, user, milestoneId = null) {
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, code: true, name: true, instructorId: true } });
  if (!course) throw new ApiError(404, 'NOT_FOUND', 'Course not found');
  if (course.instructorId !== user.id) throw new ApiError(403, 'FORBIDDEN', 'You do not teach this course');
  if (milestoneId !== null) {
    const m = await prisma.milestone.findFirst({ where: { id: milestoneId, courseId }, select: { id: true } });
    if (!m) throw new ApiError(404, 'NOT_FOUND', 'Milestone not found in this course');
  }

  const [enrollments, ratings] = await Promise.all([
    prisma.enrollment.findMany({
      where: { courseId },
      select: {
        user: {
          select: { id: true, displayName: true, memberships: { where: { courseId }, select: { team: { select: { id: true, name: true } } } } },
        },
      },
    }),
    prisma.peerRating.findMany({
      where: { milestone: { courseId }, ...(milestoneId !== null ? { milestoneId } : {}) },
      select: { rateeId: true, score: true, comment: true },
      orderBy: { id: 'asc' },
    }),
  ]);

  const received = new Map();
  for (const r of ratings) {
    if (!received.has(r.rateeId)) received.set(r.rateeId, []);
    received.get(r.rateeId).push(r);
  }
  const students = enrollments.map(({ user: u }) => {
    const rs = received.get(u.id) ?? [];
    return {
      id: u.id,
      displayName: u.displayName,
      team: u.memberships[0]?.team ?? null,
      average: averageOf(rs.map((r) => r.score)),
      count: rs.length,
      comments: rs.map((r) => r.comment).filter(Boolean),
    };
  });
  // Sorted by team name, then student name; students without a team last.
  students.sort((a, b) => {
    if (!a.team !== !b.team) return a.team ? -1 : 1;
    return (a.team && b.team ? a.team.name.localeCompare(b.team.name) : 0) || byName(a, b);
  });
  return { course: { id: course.id, code: course.code, name: course.name }, students };
}
