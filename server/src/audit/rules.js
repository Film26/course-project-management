// F-09 domain rules (pure functions, no database) — contract docs/sprints/sprint-3/F-09-audit.md §2.

export const ACTIONS = ['PROPOSAL_APPROVED', 'PROPOSAL_REJECTED', 'TEAM_CREATED', 'MEMBER_JOINED', 'MEMBER_LEFT', 'GRADE_RELEASED'];
export const LIMITS = { defaultLimit: 50, maxLimit: 100 };

// L3: the only fields stored per action. Anything else passed in (e-mail, hashes, tokens, feedback) is dropped.
const DETAIL_FIELDS = {
  PROPOSAL_APPROVED: ['title'],
  PROPOSAL_REJECTED: ['title', 'reason'],
  TEAM_CREATED: ['teamName'],
  MEMBER_JOINED: ['teamName'],
  MEMBER_LEFT: ['teamName'],
  GRADE_RELEASED: ['milestoneTitle', 'score', 'maxScore'],
};

const POSITIVE_INT = /^[1-9]\d*$/;

/** L5: `limit` 1–100 (default 50), `before` a positive id, `action` one of ACTIONS. Query values arrive as strings. */
export function parseAuditQuery(query) {
  const q = query && typeof query === 'object' ? query : {};
  const details = {};
  const value = { limit: LIMITS.defaultLimit };

  if (q.limit !== undefined) {
    const n = POSITIVE_INT.test(String(q.limit)) ? Number(q.limit) : NaN;
    if (!(n >= 1 && n <= LIMITS.maxLimit)) details.limit = `Must be a whole number from 1 to ${LIMITS.maxLimit}`;
    else value.limit = n;
  }
  if (q.before !== undefined) {
    if (!POSITIVE_INT.test(String(q.before))) details.before = 'Must be a positive integer';
    else value.before = Number(q.before);
  }
  if (q.action !== undefined) {
    if (!ACTIONS.includes(q.action)) details.action = `Must be one of ${ACTIONS.join(', ')}`;
    else value.action = q.action;
  }
  return Object.keys(details).length ? { ok: false, details } : { ok: true, value };
}

/** L3: keep only the whitelisted fields of `data` for this action. */
export function buildDetails(action, data) {
  const fields = DETAIL_FIELDS[action];
  if (!fields) throw new Error(`Unknown audit action: ${action}`);
  const out = {};
  for (const f of fields) if (data?.[f] !== undefined) out[f] = data[f];
  return out;
}
