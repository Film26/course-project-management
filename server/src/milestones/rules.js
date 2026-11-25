// F-04 domain rules (pure functions, no database) — contract docs/sprints/sprint-2/F-04-milestones.md §2.

export const LIMITS = { title: 120, description: 2000, maxWeightTotal: 100 };

const FIELDS = ['title', 'description', 'dueAt', 'weight', 'maxScore'];

// ISO 8601 date-time that states its zone (Z or ±hh:mm), so the server never guesses a time zone (A-03).
const ISO_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

/** M3: any valid instant is accepted, also one in the past. Returns the UTC instant as a Date. */
export function parseDueAt(value) {
  if (typeof value !== 'string' || !ISO_WITH_ZONE.test(value)) {
    return { ok: false, error: 'Due date must be an ISO 8601 date-time with a time zone, e.g. 2026-12-05T23:59:00+07:00' };
  }
  const date = new Date(value);
  // Reject dates that do not exist, such as 30 Feb or 31 Apr, month 13 or hour 25. Date would roll them over to
  // the next month, so rebuild the written calendar date and check that it comes back unchanged (PR #48 review).
  const [y, mo, d] = value.slice(0, 10).split('-').map(Number);
  const [h, mi] = value.slice(11, 16).split(':').map(Number);
  const written = new Date(Date.UTC(y, mo - 1, d));
  const isRealDate = written.getUTCFullYear() === y && written.getUTCMonth() === mo - 1 && written.getUTCDate() === d;
  if (Number.isNaN(date.getTime()) || !isRealDate || h > 23 || mi > 59) {
    return { ok: false, error: 'Due date is not a valid date-time' };
  }
  return { ok: true, value: date };
}

function checkText(value, label, max, { required }) {
  if (value === undefined && !required) return { value: '' };
  if (typeof value !== 'string') return { error: `${label} must be text` };
  const trimmed = value.trim();
  if (required && !trimmed) return { error: `${label} is required` };
  if (trimmed.length > max) return { error: `${label} must be at most ${max} characters` };
  return { value: trimmed };
}

function checkInt(value, label, min, max) {
  if (value === undefined || value === null) return { error: `${label} is required` };
  if (!Number.isInteger(value)) return { error: `${label} must be a whole number` };
  if (value < min || value > max) return { error: `${label} must be between ${min} and ${max}` };
  return { value };
}

const CHECKS = {
  title: (v) => checkText(v, 'Title', LIMITS.title, { required: true }),
  description: (v) => checkText(v, 'Description', LIMITS.description, { required: false }),
  dueAt: (v) => {
    if (v === undefined) return { error: 'Due date is required' };
    const r = parseDueAt(v);
    return r.ok ? { value: r.value } : { error: r.error };
  },
  weight: (v) => checkInt(v, 'Weight', 1, 100),
  maxScore: (v) => checkInt(v, 'Max score', 1, 1000),
};

/**
 * Validate a create body (title, dueAt, weight, maxScore required; description optional) or a PATCH body
 * (`partial`: only the sent fields, at least one). Fields not in the contract (e.g. courseId) are ignored.
 */
export function validateMilestoneInput(body, { partial = false } = {}) {
  const src = body && typeof body === 'object' ? body : {};
  const details = {};
  const value = {};

  for (const key of FIELDS) {
    if (partial && src[key] === undefined) continue;
    const r = CHECKS[key](src[key]);
    if (r.error) details[key] = r.error;
    else value[key] = r.value;
  }
  if (partial && FIELDS.every((k) => src[k] === undefined)) {
    details.body = `Provide at least one of ${FIELDS.join(', ')}`;
  }
  return Object.keys(details).length ? { ok: false, details } : { ok: true, value };
}

/** BR-09: the course total may reach exactly 100 % but never exceed it. `otherTotal` excludes the edited milestone. */
export function checkWeightTotal(otherTotal, weight) {
  return { ok: otherTotal + weight <= LIMITS.maxWeightTotal, currentTotal: otherTotal };
}
