// F-06 domain rules (pure functions, no database) — contract docs/sprints/sprint-2/F-06-grading.md §2.
// TDD RED stub: the signatures exist so the tests can import them; the behaviour is not implemented yet.

export const LIMITS = { feedback: 2000 };

export function validateGradeShape(body) {
  return { ok: true, value: {} };
}

export function checkScoreRange(score, maxScore) {
  return { ok: true };
}

export function canGrade({ isCurrent, releasedAt }) {
  return { ok: true };
}

export function canRelease({ grade, isCurrent, dueAt, now }) {
  return { ok: true };
}

export function visibleToStudent(grade) {
  return true;
}
