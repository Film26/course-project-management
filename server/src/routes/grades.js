// F-06 routes — contract docs/sprints/sprint-2/F-06-grading.md §3 (v1.1).
// Order of checks: authenticate (401) → role (403) → validate shape (400) → load submission (404) → ownership (403)
// → score bound (400) → business rule (409) → write.
import { Router } from 'express';
import { ApiError } from '../errors.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { validateGradeShape } from '../grades/rules.js';
import * as service from '../grades/service.js';
import { parseId } from './proposals.js';

const handle = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (err) {
    next(err);
  }
};

// Mounted under /api/submissions.
export const gradesRouter = Router();

gradesRouter.put(
  '/:id/grade',
  requireAuth,
  requireRole('INSTRUCTOR'),
  handle(async (req, res) => {
    const id = parseId(req.params.id, 'id');
    const shape = validateGradeShape(req.body);
    if (!shape.ok) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid input', shape.details);
    res.json({ grade: await service.saveGrade(id, req.user, shape.value) });
  }),
);

gradesRouter.post(
  '/:id/grade/release',
  requireAuth,
  requireRole('INSTRUCTOR'),
  handle(async (req, res) => {
    res.json({ grade: await service.releaseGrade(parseId(req.params.id, 'id'), req.user) });
  }),
);

// Mounted under /api/courses: the student's released grades.
export const courseGradesRouter = Router();

courseGradesRouter.get(
  '/:courseId/my-grades',
  requireAuth,
  requireRole('STUDENT'),
  handle(async (req, res) => {
    res.json(await service.myGrades(parseId(req.params.courseId, 'courseId'), req.user));
  }),
);
