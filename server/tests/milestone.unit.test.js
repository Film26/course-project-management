// F-04 unit tests — TEST-04-01, TEST-04-02 (docs/sprints/sprint-2/F-04-milestones.md §7)
// Pure domain rules: no database.
import { describe, it, expect } from 'vitest';
import { validateMilestoneInput, parseDueAt, checkWeightTotal } from '../src/milestones/rules.js';

const valid = {
  title: 'M1 Requirements',
  description: 'SRS and feature inventory',
  dueAt: '2026-12-01T23:59:00+07:00',
  weight: 20,
  maxScore: 100,
};

describe('TEST-04-01 validateMilestoneInput (AC-04-02)', () => {
  it('accepts a valid create body, trims text and converts dueAt to a Date in UTC', () => {
    const r = validateMilestoneInput({ ...valid, title: '  M1 Requirements ', courseId: 999 });
    expect(r.ok).toBe(true);
    expect(r.value).toEqual({
      title: 'M1 Requirements',
      description: 'SRS and feature inventory',
      dueAt: new Date('2026-12-01T16:59:00Z'),
      weight: 20,
      maxScore: 100,
    });
    expect(r.value).not.toHaveProperty('courseId');
  });

  it('description is optional on create and defaults to an empty string', () => {
    const { description, ...rest } = valid;
    const r = validateMilestoneInput(rest);
    expect(r.ok).toBe(true);
    expect(r.value.description).toBe('');
  });

  it('an empty body names every required field', () => {
    const r = validateMilestoneInput({});
    expect(r.ok).toBe(false);
    expect(Object.keys(r.details).sort()).toEqual(['dueAt', 'maxScore', 'title', 'weight']);
  });

  it.each([
    ['title', ''],
    ['title', '   '],
    ['title', 'x'.repeat(121)],
    ['description', 'x'.repeat(2001)],
    ['dueAt', '2026-12-01'],
    ['dueAt', '2026-12-01T23:59:00'],
    ['dueAt', 'tomorrow'],
    ['dueAt', '2026-13-40T25:00:00Z'],
    ['weight', 0],
    ['weight', 101],
    ['weight', 12.5],
    ['weight', '20'],
    ['maxScore', 0],
    ['maxScore', 1001],
    ['maxScore', null],
  ])('rejects %s = %j and names the field', (field, bad) => {
    const r = validateMilestoneInput({ ...valid, [field]: bad });
    expect(r.ok).toBe(false);
    expect(Object.keys(r.details)).toEqual([field]);
  });

  it.each([
    ['title', 'x'.repeat(120)],
    ['description', 'x'.repeat(2000)],
    ['weight', 1],
    ['weight', 100],
    ['maxScore', 1],
    ['maxScore', 1000],
  ])('accepts the boundary %s = %j', (field, ok) => {
    expect(validateMilestoneInput({ ...valid, [field]: ok }).ok).toBe(true);
  });

  it('partial (PATCH): validates only the sent fields and needs at least one', () => {
    expect(validateMilestoneInput({ title: 'M1 SRS' }, { partial: true })).toEqual({ ok: true, value: { title: 'M1 SRS' } });
    expect(validateMilestoneInput({ weight: 101 }, { partial: true }).details).toHaveProperty('weight');
    expect(validateMilestoneInput({}, { partial: true }).ok).toBe(false);
    expect(validateMilestoneInput({ courseId: 2 }, { partial: true }).ok).toBe(false);
  });
});

describe('parseDueAt (AC-04-02, M3)', () => {
  it('needs a date-time with Z or an offset; returns the UTC instant', () => {
    expect(parseDueAt('2026-12-01T23:59:00+07:00')).toEqual({ ok: true, value: new Date('2026-12-01T16:59:00Z') });
    expect(parseDueAt('2026-12-01T16:59:00.000Z')).toEqual({ ok: true, value: new Date('2026-12-01T16:59:00Z') });
    expect(parseDueAt('2026-12-01').ok).toBe(false);
    expect(parseDueAt(1764608340000).ok).toBe(false);
    expect(parseDueAt(undefined).ok).toBe(false);
  });

  it('accepts a due date in the past (M3)', () => {
    expect(parseDueAt('2020-01-01T00:00:00Z').ok).toBe(true);
  });
});

describe('TEST-04-02 checkWeightTotal (AC-04-03, BR-09)', () => {
  it('a total of exactly 100 % is accepted (boundary)', () => {
    expect(checkWeightTotal(90, 10)).toEqual({ ok: true, currentTotal: 90 });
    expect(checkWeightTotal(0, 100)).toEqual({ ok: true, currentTotal: 0 });
  });

  it('a total above 100 % is rejected and reports the current total', () => {
    expect(checkWeightTotal(90, 11)).toEqual({ ok: false, currentTotal: 90 });
    expect(checkWeightTotal(100, 1)).toEqual({ ok: false, currentTotal: 100 });
  });
});
