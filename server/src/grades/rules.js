// F-06 domain rules (pure functions, no database) — contract docs/sprints/sprint-2/F-06-grading.md §2 (v1.1).

export const LIMITS = { feedback: 2000 };

/** Shape checks that need no database: integer score, feedback 1–2000 characters after trim. */
export function validateGradeShape(body) {
  const src = body && typeof body === 'object' ? body : {};
  const details = {};
  if (!Number.isInteger(src.score)) details.score = 'Score must be a whole number';
  if (typeof src.feedback !== 'string' || !src.feedback.trim()) details.feedback = 'Feedback is required';
  else if (src.feedback.trim().length > LIMITS.feedback) details.feedback = `Feedback must be at most ${LIMITS.feedback} characters`;
  return Object.keys(details).length ? { ok: false, details } : { ok: true, value: { score: src.score, feedback: src.feedback.trim() } };
}

/** G1 (BR-12): 0 ≤ score ≤ maxScore. Checked after the submission (and so the milestone) is loaded. */
export function checkScoreRange(score, maxScore) {
  if (score < 0 || score > maxScore) return { ok: false, details: { score: `Score must be between 0 and ${maxScore}` } };
  return { ok: true };
}

/** G2 / G3: only an unreleased grade of the current version can be saved. */
export function canGrade({ isCurrent, releasedAt }) {
  if (releasedAt) return { ok: false, code: 'GRADE_RELEASED' };
  if (!isCurrent) return { ok: false, code: 'NOT_CURRENT_VERSION' };
  return { ok: true };
}

/** G3, G3a, G3b — check order NOT_GRADED → GRADE_RELEASED → NOT_CURRENT_VERSION → BEFORE_DUE. */
export function canRelease({ grade, isCurrent, dueAt, now }) {
  if (!grade) return { ok: false, code: 'NOT_GRADED' };
  if (grade.releasedAt) return { ok: false, code: 'GRADE_RELEASED' };
  if (!isCurrent) return { ok: false, code: 'NOT_CURRENT_VERSION' };
  if (new Date(now).getTime() <= new Date(dueAt).getTime()) return { ok: false, code: 'BEFORE_DUE' };
  return { ok: true };
}

/** G4 (BR-12): students see released grades only. */
export function visibleToStudent(grade) {
  return Boolean(grade?.releasedAt);
}
