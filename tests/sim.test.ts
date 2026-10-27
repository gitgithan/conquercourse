import { describe, expect, it } from 'vitest';
import { DT, GRAVITY, fallDistance, ticksToSeconds } from '../src/sim/units';
import { DEFAULT_PARAMS, NO_INPUT, run, startState, step, type RunnerInput } from '../src/sim/runner';

const P = DEFAULT_PARAMS;
const near = (a: number, b: number, rel: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(rel * Math.abs(b));
const sprinting: RunnerInput = { ...NO_INPUT, run: true };

describe('fall from rest', () => {
  it('drops about 4.9 m in one second on Earth', () => {
    expect(fallDistance(1)).toBeCloseTo(4.905, 3);
  });
});

describe('one clock', () => {
  it('time is the tick count over 120', () => {
    const s = run(startState(), () => sprinting, 240);
    expect(s.tick).toBe(240);
    expect(ticksToSeconds(s.tick)).toBe(2);
  });
  it('is deterministic: the same inputs give the same state', () => {
    const inputs = (t: number): RunnerInput => (t === 300 ? { ...NO_INPUT, run: true, jump: true, jumpSpeed: 4 } : sprinting);
    expect(run(startState(), inputs, 600)).toEqual(run(startState(), inputs, 600));
  });
});

describe('sprint', () => {
  const tau = P.topSpeed / P.acceleration;
  it('follows v = top (1 - e^(-t/tau)) from standstill', () => {
    for (const seconds of [0.5, 1, tau, 3]) {
      const s = run(startState(), () => sprinting, Math.round(seconds * 120));
      near(s.vx, P.topSpeed * (1 - Math.exp(-ticksToSeconds(s.tick) / tau)), 1e-9);
    }
  });
  it('reaches 63.2 % of top speed after one time constant', () => {
    const s = run(startState(), () => sprinting, Math.round(tau * 120));
    near(s.vx, P.topSpeed * (1 - Math.exp(-1)), 0.005);
  });
  it('covers x = top (t - tau (1 - e^(-t/tau)))', () => {
    const s = run(startState(), () => sprinting, 360);
    const t = ticksToSeconds(s.tick);
    near(s.x, P.topSpeed * (t - tau * (1 - Math.exp(-t / tau))), 1e-9);
  });
  it('never passes top speed', () => {
    const s = run(startState(), () => sprinting, 120 * 60);
    expect(s.vx).toBeLessThanOrEqual(P.topSpeed);
  });
});

describe('braking', () => {
  it('stops in v² / (2 grip g)', () => {
    const fast = { ...startState(), vx: 7 };
    const s = run(fast, () => NO_INPUT, 120 * 10);
    near(s.x, 49 / (2 * P.grip * GRAVITY), 1e-9);
    expect(s.vx).toBe(0);
  });
  it('takes v / (grip g) seconds', () => {
    let s = { ...startState(), vx: 7 };
    while (s.vx > 0) s = step(s, NO_INPUT, P);
    near(ticksToSeconds(s.tick), 7 / (P.grip * GRAVITY), DT / 0.9);
  });
  it('stops in a shorter distance on grippier ground', () => {
    const slick = run({ ...startState(), vx: 6 }, () => NO_INPUT, 1200, { ...P, grip: 0.4 });
    const grippy = run({ ...startState(), vx: 6 }, () => NO_INPUT, 1200, { ...P, grip: 0.8 });
    near(slick.x, 2 * grippy.x, 1e-9);
  });
});

describe('flight', () => {
  const jumpAt = (speed: number, vy: number) => {
    const start = { ...startState(), vx: speed };
    let s = step(start, { ...NO_INPUT, run: true, jump: true, jumpSpeed: vy }, P);
    const takeOffX = s.x;
    let peak = 0;
    while (!s.grounded) {
      s = step(s, NO_INPUT, P);
      peak = Math.max(peak, s.y);
    }
    return { s, takeOffX, peak };
  };
  it('lands at the projectile range 2 vx vy / g, within 1 %', () => {
    for (const [vx, vy] of [[3, 3], [5, 4], [7, 5], [8, 2]]) {
      const { s, takeOffX } = jumpAt(vx, vy);
      near(s.landedAtX! - takeOffX, (2 * vx * vy) / GRAVITY, 0.01);
    }
  });
  it('peaks at vy² / (2 g), within 1 %', () => {
    for (const vy of [2, 4, 6]) near(jumpAt(5, vy).peak, (vy * vy) / (2 * GRAVITY), 0.01);
  });
  it('has no steering in the air: horizontal speed never changes', () => {
    let s = step({ ...startState(), vx: 6 }, { ...NO_INPUT, jump: true, jumpSpeed: 4 }, P);
    while (!s.grounded) {
      s = step(s, sprinting, P);
      if (!s.grounded) expect(s.vx).toBe(6);
    }
  });
  it('spends the same time up as down', () => {
    const { s } = jumpAt(5, 4);
    near(ticksToSeconds(s.landedAtTick!) - ticksToSeconds(1), (2 * 4) / GRAVITY, 0.01);
  });
});
