// F-09 application layer: write audit entries inside the caller's transaction (L1) and read a course log.
import { prisma } from '../db.js';
import { ApiError } from '../errors.js';
import { buildDetails } from './rules.js';

/**
 * L1: call with the transaction client (`tx`) of the change being recorded, so the change and its entry are
 * committed together or not at all. A failure here rolls the whole transaction back.
 */
export function record(tx, { courseId, actorId, teamId = null, action, entityId, data }) {
  return tx.auditEntry.create({
    data: { courseId, actorId, teamId, action, entityId, details: buildDetails(action, data) },
  });
}

// FR-22 / L4 / L5: the course instructor reads the log, newest first, with an optional action filter.
export async function listCourseAudit(courseId, user, { limit, before, action }) {
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, code: true, name: true, instructorId: true } });
  if (!course) throw new ApiError(404, 'NOT_FOUND', 'Course not found');
  if (course.instructorId !== user.id) throw new ApiError(403, 'FORBIDDEN', 'You do not have access to this course');

  // One extra row tells whether an older page exists.
  const rows = await prisma.auditEntry.findMany({
    where: { courseId, ...(action ? { action } : {}), ...(before ? { id: { lt: before } } : {}) },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    select: { id: true, action: true, createdAt: true, teamId: true, entityId: true, details: true, actor: { select: { id: true, displayName: true } } },
  });
  const page = rows.slice(0, limit);

  // teamId has no FK (see schema); a deleted team is shown as null and its name stays in details.
  const teamIds = [...new Set(page.map((e) => e.teamId).filter((id) => id !== null))];
  const teams = await prisma.team.findMany({ where: { id: { in: teamIds } }, select: { id: true, name: true } });
  const teamById = new Map(teams.map((t) => [t.id, t]));

  return {
    course: { id: course.id, code: course.code, name: course.name },
    entries: page.map(({ teamId, ...e }) => ({ ...e, team: teamId === null ? null : (teamById.get(teamId) ?? null) })),
    nextBefore: rows.length > limit ? page[page.length - 1].id : null,
  };
}
