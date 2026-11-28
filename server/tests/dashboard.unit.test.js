// F-08 unit tests — TEST-08-01, TEST-08-02 (docs/sprints/sprint-3/F-08-dashboard.md §7, contract v1.1)
// Pure domain rules: no database.
import { describe, it, expect } from 'vitest';
import { currentProposal, cellFor, teamTotals } from '../src/dashboard/rules.js';

const p = (id, status, decidedAt = null) => ({ id, title: `P${id}`, status, decidedAt: decidedAt && new Date(decidedAt) });

describe('TEST-08-01 currentProposal (AC-08-01, D2)', () => {
  it('none → null', () => {
    expect(currentProposal([])).toBeNull();
  });
  it('only rejected → the newest by decidedAt, then by id', () => {
    expect(currentProposal([p(1, 'REJECTED', '2026-11-01'), p(2, 'REJECTED', '2026-11-05')])).toMatchObject({ id: 2 });
    expect(currentProposal([p(5, 'REJECTED', '2026-11-05'), p(3, 'REJECTED', '2026-11-01')])).toMatchObject({ id: 5 });
    expect(currentProposal([p(3, 'REJECTED', '2026-11-05'), p(4, 'REJECTED', '2026-11-05')])).toMatchObject({ id: 4 });
  });
  it('an active proposal wins over rejected ones', () => {
    expect(currentProposal([p(1, 'REJECTED', '2026-11-05'), p(2, 'DRAFT')])).toEqual({ id: 2, title: 'P2', status: 'DRAFT' });
    expect(currentProposal([p(7, 'APPROVED', '2026-11-02')])).toEqual({ id: 7, title: 'P7', status: 'APPROVED' });
    expect(currentProposal([p(8, 'SUBMITTED'), p(6, 'REJECTED', '2026-11-09')])).toMatchObject({ id: 8, status: 'SUBMITTED' });
  });
});

const m1 = { id: 1, weight: 20, maxScore: 100 };
const m2 = { id: 2, weight: 30, maxScore: 50 };
const v = (version, isLate = false, grade = null) => ({ id: version * 10, version, isLate, grade });

describe('TEST-08-02 cellFor and teamTotals (AC-08-02, AC-08-03, D3)', () => {
  it('no versions → NOT_SUBMITTED with no grade', () => {
    expect(cellFor(m1, [])).toEqual({ milestoneId: 1, status: 'NOT_SUBMITTED', versionCount: 0, grade: { state: 'NONE', score: null } });
  });
  it('the current (highest) version decides the status and the grade', () => {
    const old = v(1, true, { score: 40, releasedAt: null });
    const cur = v(2, false, null);
    expect(cellFor(m1, [cur, old])).toEqual({ milestoneId: 1, status: 'SUBMITTED', versionCount: 2, grade: { state: 'NONE', score: null } });
    expect(cellFor(m1, [v(1, true)])).toMatchObject({ status: 'LATE', versionCount: 1 });
  });
  it('graded but not released → GRADED; released → RELEASED', () => {
    expect(cellFor(m2, [v(1, true, { score: 35, releasedAt: null })]).grade).toEqual({ state: 'GRADED', score: 35 });
    expect(cellFor(m1, [v(1, false, { score: 85, releasedAt: new Date() })]).grade).toEqual({ state: 'RELEASED', score: 85 });
  });
  it('lateCount counts late current versions; the weighted score uses released grades only, rounded once', () => {
    const cells = [cellFor(m1, [v(2, false, { score: 85, releasedAt: new Date() }), v(1)]), cellFor(m2, [v(1, true, { score: 35, releasedAt: null })])];
    expect(teamTotals(cells, [m1, m2])).toEqual({ lateCount: 1, releasedCount: 1, releasedWeightedScore: 17 });
  });
  it('rounds half up to 2 decimals on the exact sum', () => {
    const ma = { id: 1, weight: 10, maxScore: 3 };
    const mb = { id: 2, weight: 10, maxScore: 3 };
    const rel = (score) => ({ score, releasedAt: new Date() });
    // 1/3·10 + 1/3·10 = 6.666… → 6.67 (rounding each first would give 3.33 + 3.33 = 6.66)
    const cells = [cellFor(ma, [v(1, false, rel(1))]), cellFor(mb, [v(1, false, rel(1))])];
    expect(teamTotals(cells, [ma, mb]).releasedWeightedScore).toBe(6.67);
    const half = { id: 3, weight: 1, maxScore: 8 }; // 1/8 = 0.125 → 0.13
    expect(teamTotals([cellFor(half, [v(1, false, rel(1))])], [half]).releasedWeightedScore).toBe(0.13);
  });
  it('no released grade → 0', () => {
    expect(teamTotals([cellFor(m1, [])], [m1])).toEqual({ lateCount: 0, releasedCount: 0, releasedWeightedScore: 0 });
  });
});
