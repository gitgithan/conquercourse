import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { drumsFor, drumsForPaths } from '../src/sim/drums';
import { waysOf, pathsOn } from '../src/ui/paths';
import { trackFromPlan } from '../src/sim/replay';

const course = load('two-ways.course.json');

import courseJson from '../src/course/default-course.json';
import { loadDemo as load } from './helpers/course';

describe('two ways on the drum lane and in the end report', () => {
  it('the switch is off unless paths=1', () => {
    expect(pathsOn(new URLSearchParams(''))).toBe(false);
    expect(pathsOn(new URLSearchParams('paths=1'))).toBe(true);
  });
  it('drumsForPaths gives drums for both ways, tagged by route', () => {
    const d = drumsForPaths(course)!;
    expect(d).not.toBeNull();
    const ids = new Set(d.map((x) => x.route).filter(Boolean));
    expect(ids.has('high') && ids.has('low')).toBe(true);
  });
  it('a course with no fork gets no path drums', () => {
    const plain = { ...course, branches: undefined } as CourseData;
    expect(drumsForPaths(plain)).toBeNull();
    expect(drumsFor(plain).length).toBeGreaterThan(0);
  });
  it('waysOf names the way a run took and lists both ideal times', () => {
    const b = course.branches![0];
    for (const r of b.routes) {
      const t = trackFromPlan(course, r.plan!);
      const path = Array.from(t.xs, (x, i) => ({ x, y: t.ys[i] }));
      const w = waysOf(course, path)!;
      expect(w.taken).toBe(r.id);
      expect(w.rows.length).toBe(2);
      expect(w.rows.filter((x) => x.mine).length).toBe(1);
    }
  });
  it('an old course is the same with and without the fork code', () => {
    const old = courseJson as unknown as CourseData;
    expect(drumsForPaths(old)).toBeNull();
    expect(waysOf(old, [{ x: 0, y: 0 }])).toBeNull();
    expect(drumsFor(old).some((d) => d.route)).toBe(false);
  });
  it('waysOf is null on a course with no fork', () => {
    expect(waysOf({ ...course, branches: undefined } as CourseData, [])).toBeNull();
  });
});
