import { describe, expect, it } from 'vitest';
import { GRAVITY } from '../src/sim/units';
import { DEFAULT_PARAMS, NO_INPUT, run, startState, step, type RunnerInput, type RunnerState } from '../src/sim/runner';
import { landing } from '../src/sim/landing';
import type { Terrain } from '../src/sim/terrain';

const P = DEFAULT_PARAMS;
const near = (a: number, b: number, rel: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(rel * Math.abs(b));
const sprinting: RunnerInput = { ...NO_INPUT, run: true };

// Run until the runner is within `distance` of x, then press jump with this upward speed, and fly to the end.
function jumpAt(terrain: Terrain, start: RunnerState, jumpX: number, vy: number, squat = false): RunnerState {
  let s = start;
  for (let i = 0; i < 120 * 20 && s.x < jumpX; i++) s = step(s, sprinting, P, terrain);
  s = step(s, { ...sprinting, jump: true, jumpSpeed: vy, squat }, P, terrain);
  for (let i = 0; i < 120 * 10 && !s.splashed && !s.grounded; i++) s = step(s, { ...NO_INPUT, squat }, P, terrain);
  return s;
}

describe('landing', () => {
  it('a force is speed change over time: the same landing over 3.75 x the time is 3.75 x gentler', () => {
    const stiff = landing(4, false);
    const squat = landing(4, true);
    near(stiff.peakDecel / squat.peakDecel, squat.stopTime / stiff.stopTime, 1e-9);
    near(stiff.peakDecel, 4 / stiff.stopTime, 1e-12);
  });
  it('a hard landing stumbles stiff-legged and is fine with a squat', () => {
    const v = Math.sqrt(2 * GRAVITY * 1.5); // dropping 1.5 m
    expect(landing(v, false).stumbled).toBe(true);
    expect(landing(v, true).stumbled).toBe(false);
  });
  it('a soft landing never stumbles', () => {
    expect(landing(Math.sqrt(2 * GRAVITY * 0.2), false).stumbled).toBe(false);
  });
  it('a stumble costs forward speed, a squat does not', () => {
    const drop: Terrain = { platforms: [{ x0: -50, x1: 3, top: 1.5 }, { x0: 3.001, x1: 100, top: 0 }], waterY: -2 };
    const from = { ...startState(), y: 1.5, vx: 6 };
    const land = (squat: boolean) => {
      let s = from;
      for (let i = 0; i < 120 * 5 && !s.landing; i++) s = step(s, { ...sprinting, squat }, P, drop);
      return s;
    };
    const stiff = land(false);
    const soft = land(true);
    expect(stiff.landing!.stumbled).toBe(true);
    expect(soft.landing!.stumbled).toBe(false);
    expect(soft.vx).toBeGreaterThan(stiff.vx * 2);
  });
});

describe('gap with water', () => {
  const gap: Terrain = { platforms: [{ x0: -50, x1: 10, top: 0 }, { x0: 14.5, x1: 60, top: 0 }], waterY: -1 };
  const fast: RunnerState = { ...startState(), vx: 8 };
  it('a long enough jump lands on the far platform', () => {
    const s = jumpAt(gap, fast, 9, 4);
    expect(s.splashed).toBe(false);
    expect(s.grounded).toBe(true);
    expect(s.landedAtX!).toBeGreaterThan(14.5);
  });
  it('a short jump drops into the water: the run is over', () => {
    const s = jumpAt(gap, fast, 9, 2);
    expect(s.splashed).toBe(true);
  });
  it('walking off the edge without jumping also falls in', () => {
    const s = run({ ...startState(), x: 0 }, () => sprinting, 120 * 4, P, gap);
    expect(s.splashed).toBe(true);
  });
  it('the splash is final: nothing moves afterwards', () => {
    const s = jumpAt(gap, fast, 9, 2);
    const later = step(s, sprinting, P, gap);
    expect(later.x).toBe(s.x);
    expect(later.splashed).toBe(true);
  });
});

describe('precision steps', () => {
  const blocks: Terrain = {
    platforms: [
      { x0: -50, x1: 5, top: 0 },
      { x0: 7, x1: 8, top: 0.6 },
      { x0: 10, x1: 11, top: 1.0 },
      { x0: 13, x1: 14, top: 0.4 },
      { x0: 16, x1: 60, top: 0 },
    ],
    waterY: -1,
  };
  it('running into a tall block stops against its side', () => {
    const tall: Terrain = { platforms: [{ x0: -50, x1: 100, top: 0 }, { x0: 5, x1: 6, top: 1 }], waterY: -1 };
    const s = run({ ...startState(), vx: 6 }, () => sprinting, 120 * 3, P, tall);
    expect(s.x).toBeLessThan(5);
    expect(s.vx).toBe(0);
  });
  it('a curb under the step-up height is walked onto', () => {
    const curb: Terrain = { platforms: [{ x0: -50, x1: 100, top: 0 }, { x0: 5, x1: 100, top: 0.2 }], waterY: -1 };
    const s = run({ ...startState(), vx: 6 }, () => sprinting, 120 * 3, P, curb);
    expect(s.x).toBeGreaterThan(8);
    expect(s.y).toBeCloseTo(0.2, 9);
  });
  it('a jump onto a block lands at the block top height', () => {
    const s = jumpAt(blocks, { ...startState(), vx: 8 }, 3.5, 3.6);
    expect(s.grounded).toBe(true);
    expect(s.y).toBeCloseTo(0.6, 9);
  });
  it('a jump that peaks lower than the block top hits its side and falls back', () => {
    const s = jumpAt(blocks, { ...startState(), vx: 8 }, 3.5, 2.5);
    expect(s.y).toBeLessThan(0.6);
  });
});
