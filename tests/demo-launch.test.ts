import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { playPlan, searchIdealRun, type Plan } from '../src/sim/ideal';

const load = (f: string) => JSON.parse(readFileSync(`public/assets/demo/${f}.course.json`, 'utf8')) as CourseData;
const A = load('launch'), B = load('launch-bar');

describe('the launch demo courses', () => {
  it('the stored plan throws the rider onto the tower (no bar)', () => {
    const r = playPlan(A, A.plan as Plan);
    expect(r.world.outcome).toBe('cleared');
    expect(r.events.some((e) => e.type === 'launch-release')).toBe(true);
  });
  it('letting go too early or too late misses the tower: the release time matters', () => {
    const plan = A.plan as Plan;
    const at = (d: number) => playPlan(A, { ...plan, launchRelease: plan.launchRelease! + d }).world.outcome;
    expect(at(-60)).not.toBe('cleared');
    expect(at(+60)).not.toBe('cleared');
  });
  it('without the bar the throw alone cannot reach the second tower, with the bar it can', () => {
    const plan = B.plan as Plan;
    expect(playPlan(B, plan).world.outcome).toBe('cleared');
    expect(playPlan(B, plan).events.some((e) => e.type === 'hang-catch')).toBe(true);
    const noBar = { ...B, holds: [] };
    const found = searchIdealRun(noBar);
    expect(found.cleared).toBe(false);
  });
  it('the search finds the same kind of line from nothing', () => {
    const found = searchIdealRun(A);
    expect(found.cleared).toBe(true);
    expect(found.windows.some((w) => w.obstacle === 'trebuchet release')).toBe(true);
  });
});
