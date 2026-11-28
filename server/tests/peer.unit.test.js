// F-07 unit tests — TEST-07-01, TEST-07-02 (docs/sprints/sprint-3/F-07-peer-eval.md §7, contract v1.0)
// Pure domain rules: no database.
import { describe, it, expect } from 'vitest';
import { validateRatingInput, averageOf, LIMITS } from '../src/peer/rules.js';

describe('TEST-07-01 validateRatingInput (AC-07-02)', () => {
  it.each([1, 5])('accepts score %s and trims the comment; other fields are ignored', (score) => {
    expect(validateRatingInput({ rateeId: 2, score, comment: '  Helpful ', raterId: 9 })).toEqual({
      ok: true,
      value: { rateeId: 2, score, comment: 'Helpful' },
    });
  });

  it('comment is optional (stored as "") and may be exactly 500 characters', () => {
    expect(validateRatingInput({ rateeId: 2, score: 3 })).toEqual({ ok: true, value: { rateeId: 2, score: 3, comment: '' } });
    expect(validateRatingInput({ rateeId: 2, score: 3, comment: 'x'.repeat(LIMITS.comment) }).ok).toBe(true);
  });

  it.each([
    ['score', { rateeId: 2, score: 0 }],
    ['score', { rateeId: 2, score: 6 }],
    ['score', { rateeId: 2, score: 3.5 }],
    ['score', { rateeId: 2, score: '4' }],
    ['score', { rateeId: 2 }],
    ['comment', { rateeId: 2, score: 4, comment: 'x'.repeat(LIMITS.comment + 1) }],
    ['comment', { rateeId: 2, score: 4, comment: 42 }],
    ['rateeId', { score: 4 }],
    ['rateeId', { rateeId: 0, score: 4 }],
    ['rateeId', { rateeId: '2', score: 4 }],
    ['rateeId', { rateeId: 2.5, score: 4 }],
  ])('rejects and names the field %s: %j', (field, body) => {
    const r = validateRatingInput(body);
    expect(r.ok).toBe(false);
    expect(r.details).toHaveProperty(field);
  });

  it('rejects a missing body', () => {
    expect(validateRatingInput(undefined).ok).toBe(false);
  });
});

describe('TEST-07-02 averageOf (AC-07-07, E6)', () => {
  it('returns null for no scores, the score for one, and rounds to 2 decimals', () => {
    expect(averageOf([])).toBeNull();
    expect(averageOf([4])).toBe(4);
    expect(averageOf([4, 5, 5])).toBe(4.67);
    expect(averageOf([4, 5])).toBe(4.5);
    expect(averageOf([1, 2, 2])).toBe(1.67);
  });
});
