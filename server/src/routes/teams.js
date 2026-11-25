// F-03 routes — contract docs/sprints/sprint-2/F-03-teams.md §3.
// Order of checks: authenticate (401) → role (403) → validate (400) → load (404) → enrollment/membership (403) → rule (409).
import { Router } from 'express';
import { ApiError } from '../errors.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { validateTeamName, normalizeJoinCode } from '../teams/rules.js';
import * as service from '../teams/service.js';
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

// Mounted under /api/courses: create and join a team of one course.
export const courseTeamsRouter = Router();

courseTeamsRouter.post(
  '/:courseId/teams',
  requireAuth,
  requireRole('STUDENT'),
  handle(async (req, res) => {
    const courseId = parseId(req.params.courseId, 'courseId');
    const input = validated(validateTeamName(req.body));
    res.status(201).json({ team: await service.createTeam(courseId, req.user, input) });
  }),
);

courseTeamsRouter.post(
  '/:courseId/teams/join',
  requireAuth,
  requireRole('STUDENT'),
  handle(async (req, res) => {
    const courseId = parseId(req.params.courseId, 'courseId');
    const joinCode = validated(normalizeJoinCode(req.body));
    res.json({ team: await service.joinTeam(courseId, req.user, joinCode) });
  }),
);

// Mounted under /api/teams: leave.
export const teamMembershipRouter = Router();

teamMembershipRouter.post(
  '/:teamId/leave',
  requireAuth,
  requireRole('STUDENT'),
  handle(async (req, res) => {
    res.json(await service.leaveTeam(parseId(req.params.teamId, 'teamId'), req.user));
  }),
);
