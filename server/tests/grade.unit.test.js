// F-06 unit tests — TEST-06-01 … TEST-06-03 (docs/sprints/sprint-2/F-06-grading.md §7, contract v1.1)
// Pure domain rules: no database.
import { describe, it, expect } from 'vitest';
import { validateGradeShape, checkScoreRange, canGrade, canRelease, visibleToStudent } from '../src/grades/rules.js';

describe('TEST-06-01 validateGradeShape and checkScoreRange (AC-06-02, BR-12)', () => {
  it('accepts an integer score and trims the feedback; other fields are ignored', () => {
    expect(validateGradeShape({ score: 85, feedback: '  Clear SRS ', releasedAt: '2026-01-01' })).toEqual({
      ok: true,
      value: { score: 85, feedback: 'Clear SRS' },
    });
  });

  it.each([
    ['score', undefined],
    ['score', null],
    ['score', 85.5],
    ['score', '85'],
    ['feedback', undefined],
    ['feedback', ''],
    ['feedback', '   '],
    ['feedback', 'x'.repeat(2001)],
  ])('rejects %s = %j and names the field', (field, bad) => {
    const r = validateGradeShape({ score: 85, feedback: 'ok', [field]: bad });
    expect(r.ok).toBe(false);
    expect(Object.keys(r.details)).toEqual([field]);
  });

  it('accepts 2000 characters of feedback (boundary)', () => {
    expect(validateGradeShape({ score: 1, feedback: 'x'.repeat(2000) }).ok).toBe(true);
  });

  it('0 and maxScore are accepted; -1 and maxScore + 1 are rejected with a message naming the maximum', () => {
    expect(checkScoreRange(0, 100)).toEqual({ ok: true });
    expect(checkScoreRange(100, 100)).toEqual({ ok: true });
    for (const bad of [-1, 101]) {
      const r = checkScoreRange(bad, 100);
      expect(r.ok).toBe(false);
      expect(r.details.score).toMatch(/100/);
    }
  });
});

describe('TEST-06-02 canGrade and canRelease (AC-06-03, AC-06-04, D-08 v1.1)', () => {
  const dueAt = new Date('2026-12-01T16:59:00Z');
  const after = new Date(dueAt.getTime() + 1);
  const grade = { score: 85, releasedAt: null };

  it('grading needs an unreleased grade on the current version', () => {
    expect(canGrade({ isCurrent: true, releasedAt: null })).toEqual({ ok: true });
    expect(canGrade({ isCurrent: false, releasedAt: null })).toEqual({ ok: false, code: 'NOT_CURRENT_VERSION' });
    expect(canGrade({ isCurrent: true, releasedAt: new Date() })).toEqual({ ok: false, code: 'GRADE_RELEASED' });
  });

  it('release check order: NOT_GRADED → GRADE_RELEASED → NOT_CURRENT_VERSION → BEFORE_DUE', () => {
    expect(canRelease({ grade: null, isCurrent: false, dueAt, now: dueAt })).toEqual({ ok: false, code: 'NOT_GRADED' });
    expect(canRelease({ grade: { ...grade, releasedAt: new Date() }, isCurrent: false, dueAt, now: dueAt })).toEqual({ ok: false, code: 'GRADE_RELEASED' });
    expect(canRelease({ grade, isCurrent: false, dueAt, now: dueAt })).toEqual({ ok: false, code: 'NOT_CURRENT_VERSION' });
  });

  it('release is refused before and exactly at the due date, allowed 1 ms later (G3a boundary)', () => {
    expect(canRelease({ grade, isCurrent: true, dueAt, now: new Date(dueAt.getTime() - 1) })).toEqual({ ok: false, code: 'BEFORE_DUE' });
    expect(canRelease({ grade, isCurrent: true, dueAt, now: dueAt })).toEqual({ ok: false, code: 'BEFORE_DUE' });
    expect(canRelease({ grade, isCurrent: true, dueAt, now: after })).toEqual({ ok: true });
  });
});

describe('TEST-06-03 visibleToStudent (AC-06-05, BR-12)', () => {
  it('only released grades are visible to students', () => {
    expect(visibleToStudent({ score: 85, releasedAt: null })).toBe(false);
    expect(visibleToStudent({ score: 85, releasedAt: new Date() })).toBe(true);
    expect(visibleToStudent(null)).toBe(false);
  });
});
