// F-05 domain rules (pure functions, no database) — contract docs/sprints/sprint-2/F-05-submissions.md §2.
// TDD RED stub: the signatures exist so the tests can import them; the behaviour is not implemented yet.

export const LIMITS = { url: 2000, note: 1000 };

export function validateSubmissionInput(body) {
  return { ok: true, value: {} };
}

export function isLate(dueAt, now) {
  return false;
}

export function canSubmit({ versions, dueAt, now }) {
  return { ok: true };
}

export function currentVersion(versions) {
  return null;
}

export function teamStatus(current) {
  return 'NOT_SUBMITTED';
}
