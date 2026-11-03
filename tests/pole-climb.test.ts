import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { NO_INPUT } from '../src/sim/runner';
import { newWorld, stepWorld, type WorldState } from '../src/sim/world';
import { POLEC_COST_PER_M, POLEC_REACH_X, POLEC_SLIDE_MAX, POLEC_UP, feetTop } from '../src/sim/pole-climb';
import { DT } from '../src/sim/units';

// The pole climb (CC-133, fork): hold E next to a pole to climb at a bounded pace, let go to slide back down, at the top the hands pass to the first bar.
const course = (extra: Partial<CourseData> = {}): CourseData => ({
  version: 1, name: 'pole', startX: 0, finishX: 40, jumpSpeed: 4.5, jumpKeep: 0.88,
  terrain: { waterY: -12, platforms: [{ x0: -10, x1: 60, top: 0 }] },
  hazard: 'lava',
  climbPoles: [{ x: 5, top: 3.9, toHold: 0 }],
  holds: [{ x: 5.4, y: 3.9 }, { x: 6.6, y: 3.9 }],
  ...extra,
} as unknown as CourseData);
const E = { ...NO_INPUT, handL: true, handR: true };
const go = (w: WorldState, c: CourseData, inp: typeof E | typeof NO_INPUT, n: number) => { for (let i = 0; i < n; i++) w = stepWorld(w, inp as never, c); return w; };

describe('the pole climb', () => {
  it('E next to the pole takes hold; without E, or out of reach, nothing happens', () => {
    const c = course();
    expect(go(newWorld(c, 5), c, E, 1).mode).toBe('polec');
    expect(go(newWorld(c, 5), c, NO_INPUT, 1).mode).toBe('run');
    expect(go(newWorld(c, 5 + POLEC_REACH_X + 0.2), c, E, 1).mode).toBe('run');
  });
  it('the climb has a fixed pace: the feet rise POLEC_UP a second, never faster, while E is held', () => {
    const c = course();
    let w = go(newWorld(c, 5), c, E, 1);
    const y0 = w.runner.y;
    w = go(w, c, E, 120);
    expect(w.runner.y - y0).toBeCloseTo(POLEC_UP * 120 * DT, 6);
    expect(w.runner.vy).toBe(0);
  });
  it('the climb spends energy as height: so much of the store for each metre', () => {
    const c = course();
    let w = go(newWorld(c, 5), c, E, 1);
    const e0 = w.energy;
    w = go(w, c, E, 120);
    expect(e0 - w.energy).toBeCloseTo(POLEC_COST_PER_M * POLEC_UP, 6);
  });
  it('an empty store stops the climb but the hands still hold', () => {
    const c = course();
    let w = go(newWorld(c, 5), c, E, 1);
    w = { ...w, energy: 0 };
    const y = w.runner.y;
    w = go(w, c, E, 60);
    expect(w.mode).toBe('polec');
    expect(w.runner.y).toBe(y);
  });
  it('let go of E and the body slides back to the ground at no more than the slide limit, and is not hurt', () => {
    const c = course();
    let w = go(newWorld(c, 5), c, E, 1 + 120);
    let prev = w.runner.y, fastest = 0;
    for (let i = 0; i < 400 && w.mode === 'polec'; i++) { w = stepWorld(w, NO_INPUT as never, c); fastest = Math.max(fastest, (prev - w.runner.y) / DT); prev = w.runner.y; }
    expect(fastest).toBeLessThanOrEqual(POLEC_SLIDE_MAX + 1e-9);
    expect(fastest).toBeGreaterThan(1);
    expect(w.mode).toBe('run');
    expect(w.runner.grounded).toBe(true);
    expect(w.runner.y).toBe(0);
    expect(w.outcome).toBe('running');
    expect(w.events.some((e) => e.type === 'polec-down') || w.mode === 'run').toBe(true);
  });
  it('E again while sliding takes the pole up again', () => {
    const c = course();
    let w = go(newWorld(c, 5), c, E, 1 + 100);
    w = go(w, c, NO_INPUT, 20);
    const low = w.runner.y;
    w = go(w, c, E, 30);
    expect(w.runner.y).toBeGreaterThan(low - 0.5);
    expect(w.mode).toBe('polec');
  });
  it('at the top with E held the hands pass to the first bar, and nothing jumps', () => {
    const c = course();
    let w = go(newWorld(c, 5), c, E, 1), prev = w.runner;
    let maxStep = 0;
    for (let i = 0; i < 400 && w.mode === 'polec'; i++) { w = stepWorld(w, E as never, c); maxStep = Math.max(maxStep, Math.hypot(w.runner.x - prev.x, w.runner.y - prev.y)); prev = w.runner; }
    expect(w.mode).toBe('hang');
    expect(w.hang!.hold).toBe(0);
    expect(w.events.map((e) => e.type)).toContain('polec-top');
    expect(maxStep).toBeLessThanOrEqual(POLEC_UP * DT + 1e-6);
    const t = feetTop(c.climbPoles![0]);
    expect(w.runner.y).toBeCloseTo(t, 6);
    const after = go(w, c, E, 20); // the hands ease onto the bar over a few ticks without a jump
    expect(Math.hypot(after.runner.x - w.runner.x, after.runner.y - w.runner.y)).toBeLessThan(0.5);
  });
  it('is deterministic: the same keys give the same body', () => {
    const c = course();
    const a = go(go(newWorld(c, 5), c, E, 200), c, NO_INPUT, 30), b = go(go(newWorld(c, 5), c, E, 200), c, NO_INPUT, 30);
    expect(JSON.stringify(a.runner)).toBe(JSON.stringify(b.runner));
  });
  it('a course with no poles ignores E at that place (old courses play as before)', () => {
    const c = course({ climbPoles: undefined });
    expect(go(newWorld(c, 5), c, E, 5).mode).toBe('run');
  });
});
