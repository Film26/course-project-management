// F-07 routes — contract docs/sprints/sprint-3/F-07-peer-eval.md §3.
// Order of checks: authenticate (401) → role (403) → validate (400) → load (404) → ownership (403) → rule (409).
import { Router } from 'express';
import { ApiError } from '../errors.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { validateRatingInput } from '../peer/rules.js';
import * as service from '../peer/service.js';
import { parseId } from './proposals.js';

const handle = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (err) {
    next(err);
  }
};

// Mounted under /api/milestones: rate a teammate, and the ratings the student gave.
export const milestonePeerRouter = Router();

milestonePeerRouter.post(
  '/:id/peer-ratings',
  requireAuth,
  requireRole('STUDENT'),
  handle(async (req, res) => {
    const id = parseId(req.params.id, 'id');
    const input = validateRatingInput(req.body);
    if (!input.ok) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid input', input.details);
    res.status(201).json({ rating: await service.rateTeammate(id, req.user, input.value) });
  }),
);

milestonePeerRouter.get(
  '/:id/peer-ratings/mine',
  requireAuth,
  requireRole('STUDENT'),
  handle(async (req, res) => {
    res.json(await service.myRatings(parseId(req.params.id, 'id'), req.user));
  }),
);

// Mounted under /api/courses: per-student averages for the course instructor.
export const coursePeerRouter = Router();

coursePeerRouter.get(
  '/:courseId/peer-ratings',
  requireAuth,
  requireRole('INSTRUCTOR'),
  handle(async (req, res) => {
    const courseId = parseId(req.params.courseId, 'courseId');
    const milestoneId = req.query.milestoneId === undefined ? null : parseId(req.query.milestoneId, 'milestoneId');
    res.json(await service.courseSummary(courseId, req.user, milestoneId));
  }),
);
