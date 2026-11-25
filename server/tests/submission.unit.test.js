// F-05 unit tests — TEST-05-01 … TEST-05-04 (docs/sprints/sprint-2/F-05-submissions.md §7)
// Pure domain rules: no database.
import { describe, it, expect } from 'vitest';
import { validateSubmissionInput, isLate, canSubmit, currentVersion, teamStatus } from '../src/submissions/rules.js';

describe('TEST-05-01 validateSubmissionInput (AC-05-02)', () => {
  it('trims the URL and note, defaults the note to "" and ignores other fields', () => {
    expect(validateSubmissionInput({ url: ' https://github.com/x/y ', note: ' v1 ', teamId: 9, isLate: true })).toEqual({
      ok: true,
      value: { url: 'https://github.com/x/y', note: 'v1' },
    });
    expect(validateSubmissionInput({ url: 'http://example.com' })).toEqual({ ok: true, value: { url: 'http://example.com', note: '' } });
  });

  it.each([
    ['url', undefined],
    ['url', ''],
    ['url', '   '],
    ['url', 'github.com/x'],
    ['url', 'javascript:alert(1)'],
    ['url', 'ftp://files.example.com/a'],
    ['url', 'https://'],
    ['url', `https://example.com/${'a'.repeat(2001 - 20)}`],
    ['url', 42],
    ['note', 'x'.repeat(1001)],
    ['note', 7],
  ])('rejects %s = %j and names the field', (field, bad) => {
    const r = validateSubmissionInput({ url: 'https://github.com/x/y', note: '', [field]: bad });
    expect(r.ok).toBe(false);
    expect(Object.keys(r.details)).toEqual([field]);
  });

  it('accepts a 2000-character URL and a 1000-character note (boundaries)', () => {
    const url = `https://example.com/${'a'.repeat(2000 - 20)}`;
    expect(url).toHaveLength(2000);
    expect(validateSubmissionInput({ url, note: 'x'.repeat(1000) }).ok).toBe(true);
  });
});

describe('TEST-05-02 isLate (AC-05-04, AC-05-05, BR-11)', () => {
  const D = new Date('2026-12-01T16:59:00Z');
  it('exactly at the due date is on time; one millisecond later is late', () => {
    expect(isLate(D, new Date(D.getTime() - 1))).toBe(false);
    expect(isLate(D, D)).toBe(false);
    expect(isLate(D, new Date(D.getTime() + 1))).toBe(true);
  });
});

describe('TEST-05-03 canSubmit (AC-05-06, BR-11)', () => {
  const dueAt = new Date('2026-12-01T16:59:00Z');
  const before = new Date(dueAt.getTime() - 1000);
  const after = new Date(dueAt.getTime() + 1000);
  const onTime = { version: 1, isLate: false };
  const late = { version: 1, isLate: true };

  it('before the due date a team may always (re)submit', () => {
    for (const versions of [[], [onTime], [late]]) expect(canSubmit({ versions, dueAt, now: before })).toEqual({ ok: true });
  });

  it('after the due date: allowed without versions or with only late ones, refused once an on-time version exists', () => {
    expect(canSubmit({ versions: [], dueAt, now: after })).toEqual({ ok: true });
    expect(canSubmit({ versions: [late], dueAt, now: after })).toEqual({ ok: true });
    expect(canSubmit({ versions: [late, { version: 2, isLate: true }], dueAt, now: after })).toEqual({ ok: true });
    expect(canSubmit({ versions: [onTime], dueAt, now: after })).toEqual({ ok: false, code: 'RESUBMISSION_CLOSED' });
    expect(canSubmit({ versions: [onTime, { version: 2, isLate: true }], dueAt, now: after })).toEqual({ ok: false, code: 'RESUBMISSION_CLOSED' });
  });
});

describe('TEST-05-04 currentVersion and teamStatus (AC-05-07, FR-14)', () => {
  it('the current version is the highest one', () => {
    expect(currentVersion([])).toBeNull();
    expect(currentVersion([{ version: 1 }, { version: 3 }, { version: 2 }])).toEqual({ version: 3 });
  });

  it('status comes from the current version', () => {
    expect(teamStatus(null)).toBe('NOT_SUBMITTED');
    expect(teamStatus({ version: 2, isLate: false })).toBe('SUBMITTED');
    expect(teamStatus({ version: 2, isLate: true })).toBe('LATE');
  });
});
