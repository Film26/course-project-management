// F-09 route — contract docs/sprints/sprint-3/F-09-audit.md §3.
// Order of checks: authenticate (401) → role (403) → validate (400) → load course (404) → ownership (403).
import { Router } from 'express';
import { ApiError } from '../errors.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { parseAuditQuery } from '../audit/rules.js';
import { listCourseAudit } from '../audit/service.js';
import { parseId } from './proposals.js';

// Mounted under /api/courses.
export const courseAuditRouter = Router();

courseAuditRouter.get('/:courseId/audit', requireAuth, requireRole('INSTRUCTOR'), async (req, res, next) => {
  try {
    const courseId = parseId(req.params.courseId, 'courseId');
    const query = parseAuditQuery(req.query);
    if (!query.ok) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid query', query.details);
    res.json(await listCourseAudit(courseId, req.user, query.value));
  } catch (err) {
    next(err);
  }
});
