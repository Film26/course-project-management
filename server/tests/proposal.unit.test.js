// F-02 unit tests — TEST-02-01 … TEST-02-04 (docs/sprints/sprint-1/F-02-proposal.md §7)
// Pure domain rules: no database.
import { describe, it, expect } from 'vitest';
import {
  canTransition,
  isBeforeDeadline,
  isActiveStatus,
  validateProposalInput,
  validateRejectReason,
  parseStatusFilter,
} from '../src/proposals/rules.js';

const STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'];

describe('TEST-02-01 canTransition (AC-02-07, BR-03)', () => {
  const allowed = new Set(['DRAFT>SUBMITTED', 'SUBMITTED>APPROVED', 'SUBMITTED>REJECTED']);

  for (const from of STATUSES) {
    for (const to of STATUSES) {
      const expected = allowed.has(`${from}>${to}`);
      it(`${from} → ${to} is ${expected ? 'allowed' : 'rejected'}`, () => {
        expect(canTransition(from, to)).toBe(expected);
      });
    }
  }

  it('rejects unknown statuses', () => {
    expect(canTransition('DRAFT', 'ARCHIVED')).toBe(false);
    expect(canTransition(undefined, 'SUBMITTED')).toBe(false);
  });
});

describe('TEST-02-02 isBeforeDeadline (AC-02-05, AC-02-06, BR-02)', () => {
  const deadline = new Date('2026-12-31T16:59:59.000Z');

  it('allows submission 1 ms before the deadline', () => {
    expect(isBeforeDeadline(deadline, new Date(deadline.getTime() - 1))).toBe(true);
  });
  it('allows submission exactly at the deadline (boundary)', () => {
    expect(isBeforeDeadline(deadline, new Date(deadline.getTime()))).toBe(true);
  });
  it('rejects submission 1 ms after the deadline', () => {
    expect(isBeforeDeadline(deadline, new Date(deadline.getTime() + 1))).toBe(false);
  });
});

describe('TEST-02-03 isActiveStatus (AC-02-02, BR-01)', () => {
  it('treats DRAFT, SUBMITTED and APPROVED as active and REJECTED as inactive', () => {
    expect(STATUSES.map((s) => [s, isActiveStatus(s)])).toEqual([
      ['DRAFT', true],
      ['SUBMITTED', true],
      ['APPROVED', true],
      ['REJECTED', false],
    ]);
  });
});

describe('TEST-02-04 input validation (AC-02-03, AC-02-09, BR-04)', () => {
  it('requires title and description on create', () => {
    const r = validateProposalInput({});
    expect(r.ok).toBe(false);
    expect(Object.keys(r.details).sort()).toEqual(['description', 'title']);
  });

  it('rejects blank strings and non-strings', () => {
    const r = validateProposalInput({ title: '   ', description: 42 });
    expect(r.ok).toBe(false);
    expect(r.details.title).toBeDefined();
    expect(r.details.description).toBeDefined();
  });

  it('enforces the 120-char title and 5000-char description limits', () => {
    expect(validateProposalInput({ title: 'x'.repeat(120), description: 'd'.repeat(5000) }).ok).toBe(true);
    const r = validateProposalInput({ title: 'x'.repeat(121), description: 'd'.repeat(5001) });
    expect(r.ok).toBe(false);
    expect(Object.keys(r.details).sort()).toEqual(['description', 'title']);
  });

  it('returns trimmed values and ignores unknown fields', () => {
    const r = validateProposalInput({ title: '  Smart Parking  ', description: ' IoT app ', status: 'APPROVED', teamId: 9 });
    expect(r).toEqual({ ok: true, value: { title: 'Smart Parking', description: 'IoT app' } });
  });

  it('partial (edit) mode accepts one field but requires at least one', () => {
    expect(validateProposalInput({ title: 'New title' }, { partial: true })).toEqual({ ok: true, value: { title: 'New title' } });
    const none = validateProposalInput({}, { partial: true });
    expect(none.ok).toBe(false);
    expect(none.details).toHaveProperty('body');
    expect(validateProposalInput({ description: '' }, { partial: true }).details).toHaveProperty('description');
  });

  it('reject reason: required, trimmed, at most 500 characters', () => {
    expect(validateRejectReason({}).ok).toBe(false);
    expect(validateRejectReason({ reason: '' }).ok).toBe(false);
    expect(validateRejectReason({ reason: '   ' }).ok).toBe(false);
    expect(validateRejectReason({ reason: 'r'.repeat(501) }).details.reason).toBeDefined();
    expect(validateRejectReason({ reason: 'r'.repeat(500) }).ok).toBe(true);
    expect(validateRejectReason({ reason: '  Scope too large  ' })).toEqual({ ok: true, value: 'Scope too large' });
  });

  it('status filter: optional, must be a known status', () => {
    expect(parseStatusFilter(undefined)).toEqual({ ok: true, value: undefined });
    expect(parseStatusFilter('SUBMITTED')).toEqual({ ok: true, value: 'SUBMITTED' });
    expect(parseStatusFilter('BOGUS').ok).toBe(false);
  });
});
