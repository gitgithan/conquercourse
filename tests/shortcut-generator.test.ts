import { describe, expect, it } from 'vitest';
import { generateChecked, generateCourse } from '../src/slice/generator';
import type { Shortcut } from '../src/sim/shortcuts';

const fake = (id: string): Shortcut => ({ id, skipped: ['Bar 2'], how: 'x', secondsSaved: 1, seconds: 5, pumpSeconds: null, windowMs: null, designed: false, plan: { jumpXs: [], releaseAfter: 60, bouncePress: 8 } });

describe('generator shortcut check', () => {
  it('refuse: moves on to the next seed until a course has no shortcut', () => {
    const seen: string[] = [];
    const r = generateChecked(5, { shortcuts: 'refuse', tries: 4, find: (c) => { seen.push(c.name); return seen.length < 3 ? [fake('skip-bar-2')] : []; } });
    expect(seen.length).toBe(3);
    expect(r.shortcuts).toEqual([]);
    expect(r.refused).toEqual([5, 5 + 7919]);
    expect(r.seed).toBe(5 + 2 * 7919);
    expect(r.course.name).toBe(generateCourse(r.seed).name);
  });
  it('label: keeps the course and stores what was found', () => {
    const r = generateChecked(5, { shortcuts: 'label', find: () => [fake('skip-bar-2')] });
    expect(r.course.shortcuts?.map((s) => s.id)).toEqual(['skip-bar-2']);
    expect(r.refused).toEqual([5]);
  });
});
