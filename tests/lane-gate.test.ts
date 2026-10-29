import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { newWorld, stepWorld } from '../src/sim/world';
import { NO_INPUT } from '../src/sim/runner';

// CC-228: a gated platform is air until the runner has stood on its gate platform.
const base = (gate?: number): CourseData => ({
  version: 1, name: 'gate', startX: 0, finishX: 60, jumpSpeed: 4.5, jumpKeep: 0.88,
  terrain: { waterY: -12, platforms: [{ x0: -10, x1: 24, top: 0 }, { x0: 26, x1: 30, top: -4 }, { x0: 31.5, x1: 36, top: -4, ...(gate === undefined ? {} : { gate }) }] },
  hazard: 'lava',
} as unknown as CourseData);
const run = (c: CourseData, x: number, ticks: number, stood?: number[]) => {
  let w = newWorld(c, x);
  if (stood) w = { ...w, stood };
  for (let i = 0; i < ticks; i++) w = stepWorld(w, { ...NO_INPUT, run: true } as never, c);
  return w;
};

describe('the lane gate', () => {
  it('a gated floor is air until its gate platform has been stood on', () => {
    const c = base(1);
    const w = run(c, 32, 30);
    expect(w.runner.grounded).toBe(false);
    expect(w.runner.y).toBeLessThan(-4);
  });
  it('after standing on the gate platform the floor is solid, and the stand is remembered', () => {
    const c = base(1);
    const w = run(c, 32, 30, [1]);
    expect(w.runner.grounded).toBe(true);
    expect(w.runner.y).toBeCloseTo(-4, 6);
    expect(w.stood).toContain(2);
  });
  it('a course with no gate keeps no record and plays as before', () => {
    const c = base();
    const w = run(c, 32, 30);
    expect(w.runner.grounded).toBe(true);
    expect('stood' in w).toBe(false);
  });
});
