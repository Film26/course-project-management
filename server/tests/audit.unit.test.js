// F-09 unit tests — TEST-09-01, TEST-09-02 (docs/sprints/sprint-3/F-09-audit.md §7)
// Pure domain rules: no database.
import { describe, it, expect } from 'vitest';
import { parseAuditQuery, buildDetails } from '../src/audit/rules.js';

describe('TEST-09-01 parseAuditQuery (AC-09-05)', () => {
  it('defaults to 50 entries, no cursor, no filter', () => {
    expect(parseAuditQuery({})).toEqual({ ok: true, value: { limit: 50 } });
  });

  it('accepts the limit boundaries 1 and 100, a cursor and a known action', () => {
    expect(parseAuditQuery({ limit: '1' })).toEqual({ ok: true, value: { limit: 1 } });
    expect(parseAuditQuery({ limit: '100', before: '42', action: 'PROPOSAL_REJECTED' })).toEqual({
      ok: true,
      value: { limit: 100, before: 42, action: 'PROPOSAL_REJECTED' },
    });
  });

  it.each([
    ['limit', '0'],
    ['limit', '101'],
    ['limit', 'x'],
    ['limit', '2.5'],
    ['before', '-1'],
    ['before', '0'],
    ['before', 'abc'],
    ['action', 'BOGUS'],
    ['action', 'proposal_rejected'],
  ])('rejects %s = %j and names the field', (field, bad) => {
    const r = parseAuditQuery({ [field]: bad });
    expect(r.ok).toBe(false);
    expect(Object.keys(r.details)).toEqual([field]);
  });
});

describe('TEST-09-02 buildDetails keeps only the whitelisted fields (L3)', () => {
  const noise = { email: 'student1@cpms.test', passwordHash: '$2a$10$secret', token: 'abc' };

  it('proposal approved: title only', () => {
    expect(buildDetails('PROPOSAL_APPROVED', { title: 'Smart Parking', reason: null, ...noise })).toEqual({ title: 'Smart Parking' });
  });

  it('proposal rejected: title and reason', () => {
    expect(buildDetails('PROPOSAL_REJECTED', { title: 'Smart Parking', reason: 'Too broad', ...noise })).toEqual({
      title: 'Smart Parking',
      reason: 'Too broad',
    });
  });

  it('membership actions: team name only (A2)', () => {
    for (const action of ['TEAM_CREATED', 'MEMBER_JOINED', 'MEMBER_LEFT']) {
      expect(buildDetails(action, { teamName: 'Team Gamma', joinCode: 'GAMMA234', ...noise })).toEqual({ teamName: 'Team Gamma' });
    }
  });

  it('grade released: milestone title, score and max score (A3)', () => {
    expect(buildDetails('GRADE_RELEASED', { milestoneTitle: 'M1', score: 85, maxScore: 100, feedback: 'private', ...noise })).toEqual({
      milestoneTitle: 'M1',
      score: 85,
      maxScore: 100,
    });
  });

  it('an unknown action is a programming error', () => {
    expect(() => buildDetails('PROPOSAL_DELETED', {})).toThrow();
  });
});
