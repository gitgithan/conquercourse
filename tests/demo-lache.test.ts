import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { searchIdealRun } from '../src/sim/ideal';
import { drumsFor } from '../src/sim/drums';

// The demo course: a run, a vault over a 1 m box, then the lache pair across 8.5 m of water.
const course = JSON.parse(readFileSync('public/assets/demo/lache.course.json', 'utf8')) as CourseData;

describe('the lache demo course', () => {
  const r = searchIdealRun(course);
  it('can be cleared, with a vault over the box and a built-up swing on the first bar', () => {
    expect(r.cleared).toBe(true);
    expect(r.plan.vaultXs?.length).toBeGreaterThanOrEqual(1);
    expect(r.plan.hangTicks![0]).toBeGreaterThan(120);
  });
  it('needs the bars: with them taken away, no run-and-jump clears the water', () => {
    expect(searchIdealRun({ ...course, holds: undefined }).cleared).toBe(false);
  });
  it('the drum lane shows the vault, the grabs and the releases', () => {
    const kinds = new Set(drumsFor(course).map((d) => d.what));
    for (const k of ['vault', 'grab', 'release']) expect(kinds.has(k as 'vault')).toBe(true);
  });
});
