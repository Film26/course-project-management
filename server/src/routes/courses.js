// F-01 FR-04: course roster — INSTRUCTOR role + course ownership (R5, R6)
import { Router } from 'express';
import { prisma } from '../db.js';
import { ApiError } from '../errors.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { parseStatusFilter } from '../proposals/rules.js';
import { listCourseProposals, getMyTeam } from '../proposals/service.js';
import { parseId } from './proposals.js';

export const coursesRouter = Router();

coursesRouter.get('/:courseId/roster', requireAuth, requireRole('INSTRUCTOR'), async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isInteger(courseId) || courseId <= 0) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid course id', { courseId: 'Must be a positive integer' });
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        teams: {
          orderBy: { name: 'asc' },
          include: {
            members: {
              include: { user: { select: { id: true, displayName: true, email: true } } },
              orderBy: { userId: 'asc' },
            },
          },
        },
      },
    });
    if (!course) throw new ApiError(404, 'NOT_FOUND', 'Course not found');
    if (course.instructorId !== req.user.id) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not have access to this course');
    }

    res.json({
      course: { id: course.id, code: course.code, name: course.name },
      teams: course.teams.map((t) => ({
        id: t.id,
        name: t.name,
        members: t.members.map((m) => m.user),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// Courses visible to the current user (used by the UI to find the roster link).
coursesRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const where =
      req.user.role === 'INSTRUCTOR'
        ? { instructorId: req.user.id }
        : { teams: { some: { members: { some: { userId: req.user.id } } } } };
    const courses = await prisma.course.findMany({
      where,
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    });
    res.json({ courses });
  } catch (err) {
    next(err);
  }
});

// F-02 FR-07: proposals of a course — INSTRUCTOR who teaches it, optional ?status= filter.
coursesRouter.get('/:courseId/proposals', requireAuth, requireRole('INSTRUCTOR'), async (req, res, next) => {
  try {
    const courseId = parseId(req.params.courseId, 'courseId');
    const filter = parseStatusFilter(req.query.status);
    if (!filter.ok) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid status filter', filter.details);
    res.json(await listCourseProposals(courseId, req.user, filter.value));
  } catch (err) {
    next(err);
  }
});

// F-02 FR-09: the current student's team in a course with its proposals and decisions.
coursesRouter.get('/:courseId/my-team', requireAuth, requireRole('STUDENT'), async (req, res, next) => {
  try {
    res.json(await getMyTeam(parseId(req.params.courseId, 'courseId'), req.user));
  } catch (err) {
    next(err);
  }
});
