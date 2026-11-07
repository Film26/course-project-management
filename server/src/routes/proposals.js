// F-02 routes — contract docs/sprints/sprint-1/F-02-proposal.md §3.
// Identity and role come only from the session (requireAuth); the body never selects a team status or user.
import { Router } from 'express';
import { ApiError } from '../errors.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { validateProposalInput, validateRejectReason } from '../proposals/rules.js';
import * as service from '../proposals/service.js';

export function parseId(value, name) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', `Invalid ${name}`, { [name]: 'Must be a positive integer' });
  }
  return id;
}

function validated(result) {
  if (!result.ok) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid input', result.details);
  return result.value;
}

// Wrap async handlers so errors reach the shared error handler.
const handle = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (err) {
    next(err);
  }
};

// POST /api/teams/:teamId/proposals — FR-05, BR-01, BR-05
export const teamsRouter = Router();
teamsRouter.post(
  '/:teamId/proposals',
  requireAuth,
  requireRole('STUDENT'),
  handle(async (req, res) => {
    const teamId = parseId(req.params.teamId, 'teamId');
    const input = validated(validateProposalInput(req.body));
    const proposal = await service.createProposal(teamId, req.user, input);
    res.status(201).json({ proposal });
  }),
);

// /api/proposals/:id… — FR-05, FR-06, FR-08, FR-09
export const proposalsRouter = Router();

proposalsRouter.get(
  '/:id',
  requireAuth,
  handle(async (req, res) => {
    res.json(await service.getProposal(parseId(req.params.id, 'id'), req.user));
  }),
);

proposalsRouter.patch(
  '/:id',
  requireAuth,
  requireRole('STUDENT'),
  handle(async (req, res) => {
    const id = parseId(req.params.id, 'id');
    const changes = validated(validateProposalInput(req.body, { partial: true }));
    res.json({ proposal: await service.updateDraft(id, req.user, changes) });
  }),
);

proposalsRouter.post(
  '/:id/submit',
  requireAuth,
  requireRole('STUDENT'),
  handle(async (req, res) => {
    res.json({ proposal: await service.submitProposal(parseId(req.params.id, 'id'), req.user) });
  }),
);

proposalsRouter.post(
  '/:id/approve',
  requireAuth,
  requireRole('INSTRUCTOR'),
  handle(async (req, res) => {
    res.json({ proposal: await service.decideProposal(parseId(req.params.id, 'id'), req.user, 'APPROVED') });
  }),
);

proposalsRouter.post(
  '/:id/reject',
  requireAuth,
  requireRole('INSTRUCTOR'),
  handle(async (req, res) => {
    const id = parseId(req.params.id, 'id');
    const reason = validated(validateRejectReason(req.body));
    res.json({ proposal: await service.decideProposal(id, req.user, 'REJECTED', reason) });
  }),
);
