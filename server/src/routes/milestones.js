// F-04 routes — contract docs/sprints/sprint-2/F-04-milestones.md §3.
// Order of checks: authenticate (401) → role (403) → validate (400) → load (404) → ownership (403) → rule (409).
import { Router } from 'express';
import { ApiError } from '../errors.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { validateMilestoneInput } from '../milestones/rules.js';
import * as service from '../milestones/service.js';
import { parseId } from './proposals.js';

function validated(result) {
  if (!result.ok) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid input', result.details);
  return result.value;
}

const handle = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (err) {
    next(err);
  }
};

// Mounted under /api/courses: list and create the milestones of one course.
export const courseMilestonesRouter = Router();

courseMilestonesRouter.get(
  '/:courseId/milestones',
  requireAuth,
  requireRole('INSTRUCTOR', 'STUDENT'),
  handle(async (req, res) => {
    res.json(await service.listMilestones(parseId(req.params.courseId, 'courseId'), req.user));
  }),
);

courseMilestonesRouter.post(
  '/:courseId/milestones',
  requireAuth,
  requireRole('INSTRUCTOR'),
  handle(async (req, res) => {
    const courseId = parseId(req.params.courseId, 'courseId');
    const input = validated(validateMilestoneInput(req.body));
    res.status(201).json({ milestone: await service.createMilestone(courseId, req.user, input) });
  }),
);

// /api/milestones/:id — edit and delete.
export const milestonesRouter = Router();

milestonesRouter.patch(
  '/:id',
  requireAuth,
  requireRole('INSTRUCTOR'),
  handle(async (req, res) => {
    const id = parseId(req.params.id, 'id');
    const changes = validated(validateMilestoneInput(req.body, { partial: true }));
    res.json({ milestone: await service.updateMilestone(id, req.user, changes) });
  }),
);

milestonesRouter.delete(
  '/:id',
  requireAuth,
  requireRole('INSTRUCTOR'),
  handle(async (req, res) => {
    await service.deleteMilestone(parseId(req.params.id, 'id'), req.user);
    res.status(204).end();
  }),
);
