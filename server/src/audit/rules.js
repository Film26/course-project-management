// F-09 domain rules (pure functions, no database) — contract docs/sprints/sprint-3/F-09-audit.md §2.
// TDD RED stub: the signatures exist so the tests can import them; the behaviour is not implemented yet.

export const ACTIONS = ['PROPOSAL_APPROVED', 'PROPOSAL_REJECTED', 'TEAM_CREATED', 'MEMBER_JOINED', 'MEMBER_LEFT', 'GRADE_RELEASED'];
export const LIMITS = { defaultLimit: 50, maxLimit: 100 };

export function parseAuditQuery(query) {
  return { ok: true, value: {} };
}

export function buildDetails(action, data) {
  return {};
}
