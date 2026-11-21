// F-02 domain rules (pure functions, no database) — contract docs/sprints/sprint-1/F-02-proposal.md §2.

export const STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'];

// BR-01: a team may hold at most one proposal in one of these statuses.
export const ACTIVE_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED'];

// BR-03: the only allowed transitions. APPROVED and REJECTED are final.
const TRANSITIONS = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['APPROVED', 'REJECTED'],
  APPROVED: [],
  REJECTED: [],
};

export const LIMITS = { title: 120, description: 5000, reason: 500 };

export function isActiveStatus(status) {
  return ACTIVE_STATUSES.includes(status);
}

export function canTransition(from, to) {
  return Object.hasOwn(TRANSITIONS, from) && TRANSITIONS[from].includes(to);
}

// BR-02: submitting exactly at the deadline is still on time; one millisecond later is not.
export function isBeforeDeadline(deadline, now) {
  return new Date(now).getTime() <= new Date(deadline).getTime();
}

function checkText(value, label, max) {
  if (typeof value !== 'string' || !value.trim()) return { error: `${label} is required` };
  const trimmed = value.trim();
  if (trimmed.length > max) return { error: `${label} must be at most ${max} characters` };
  return { value: trimmed };
}

/**
 * Validate a create (all fields required) or edit (`partial`, at least one field) body.
 * Only `title` and `description` are read; anything else in the body is ignored.
 */
export function validateProposalInput(body, { partial = false } = {}) {
  const src = body && typeof body === 'object' ? body : {};
  const details = {};
  const value = {};
  const fields = [
    ['title', 'Title', LIMITS.title],
    ['description', 'Description', LIMITS.description],
  ];

  for (const [key, label, max] of fields) {
    if (partial && src[key] === undefined) continue;
    const r = checkText(src[key], label, max);
    if (r.error) details[key] = r.error;
    else value[key] = r.value;
  }
  if (partial && src.title === undefined && src.description === undefined) {
    details.body = 'Provide a title or a description to update';
  }
  return Object.keys(details).length ? { ok: false, details } : { ok: true, value };
}

// BR-04: a rejection needs a non-empty reason of at most 500 characters.
export function validateRejectReason(body) {
  const r = checkText(body?.reason, 'Reason', LIMITS.reason);
  return r.error ? { ok: false, details: { reason: r.error } } : { ok: true, value: r.value };
}

export function parseStatusFilter(status) {
  if (status === undefined) return { ok: true, value: undefined };
  if (STATUSES.includes(status)) return { ok: true, value: status };
  return { ok: false, details: { status: `Must be one of ${STATUSES.join(', ')}` } };
}
