// F-05 domain rules (pure functions, no database) — contract docs/sprints/sprint-2/F-05-submissions.md §2.

export const LIMITS = { url: 2000, note: 1000 };

/** Validation: url required, http(s), ≤ 2000 chars; note optional, ≤ 1000 chars. Other fields are ignored. */
export function validateSubmissionInput(body) {
  const src = body && typeof body === 'object' ? body : {};
  const details = {};
  const value = {};

  if (typeof src.url !== 'string' || !src.url.trim()) {
    details.url = 'URL is required';
  } else {
    const url = src.url.trim();
    let parsed = null;
    try {
      parsed = new URL(url);
    } catch {
      parsed = null;
    }
    if (url.length > LIMITS.url) details.url = `URL must be at most ${LIMITS.url} characters`;
    else if (!parsed || !['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) details.url = 'URL must start with http:// or https://';
    else value.url = url;
  }

  if (src.note === undefined) value.note = '';
  else if (typeof src.note !== 'string') details.note = 'Note must be text';
  else if (src.note.trim().length > LIMITS.note) details.note = `Note must be at most ${LIMITS.note} characters`;
  else value.note = src.note.trim();

  return Object.keys(details).length ? { ok: false, details } : { ok: true, value };
}

/** S2 (BR-11): late means after the due date; exactly at the due date is on time (same rule as BR-02). */
export function isLate(dueAt, now) {
  return new Date(now).getTime() > new Date(dueAt).getTime();
}

/** S3 (BR-11): after the due date, no new version once an on-time version exists. */
export function canSubmit({ versions, dueAt, now }) {
  if (isLate(dueAt, now) && versions.some((v) => !v.isLate)) return { ok: false, code: 'RESUBMISSION_CLOSED' };
  return { ok: true };
}

/** S4: the current version is the highest one. */
export function currentVersion(versions) {
  return versions.reduce((cur, v) => (cur === null || v.version > cur.version ? v : cur), null);
}

/** S7 (FR-14): the team's status for a milestone, from its current version. */
export function teamStatus(current) {
  if (!current) return 'NOT_SUBMITTED';
  return current.isLate ? 'LATE' : 'SUBMITTED';
}
