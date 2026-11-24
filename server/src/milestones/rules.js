// F-04 domain rules (pure functions, no database) — contract docs/sprints/sprint-2/F-04-milestones.md §2.
// TDD RED stub: the signatures exist so the tests can import them; the behaviour is not implemented yet.

export const LIMITS = { title: 120, description: 2000, maxWeightTotal: 100 };

export function validateMilestoneInput(body, { partial = false } = {}) {
  return { ok: true, value: {} };
}

export function parseDueAt(value) {
  return { ok: true, value: null };
}

export function checkWeightTotal(otherTotal, weight) {
  return { ok: true, currentTotal: otherTotal };
}
