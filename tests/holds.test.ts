import { describe, expect, it } from 'vitest';
import { DEFAULT_HANG, feetOf, hangStep, measureHangPeriod, pendulumLength, releaseHang, tryGrab, type Hang } from '../src/sim/holds';
import { GRAVITY } from '../src/sim/units';

const NO_DRAG = { ...DEFAULT_HANG, drag: 0 };
const amplitude = (s0: Hang, steps: number, pumpFor: (s: Hang) => -1 | 0 | 1, p = DEFAULT_HANG) => {
  let s = s0, max = 0;
  for (let i = 0; i < steps; i++) { s = hangStep(s, pumpFor(s), p); max = Math.max(max, Math.abs(s.theta)); }
  return max;
};

describe('a body hanging from a bar swings like a pendulum', () => {
  it('a small swing takes 2 pi sqrt(L / g) (within 1 percent)', () => {
    const T = 2 * Math.PI * Math.sqrt(pendulumLength() / GRAVITY);
    expect(Math.abs(measureHangPeriod(0.05) - T) / T).toBeLessThan(0.01);
  });
  it('a swing with nothing pumping and no drag keeps its energy', () => {
    const start: Hang = { hold: 0, theta: 0.6, omega: 0 };
    const L = pendulumLength(NO_DRAG), E = (s: Hang) => 0.5 * L * L * s.omega * s.omega + GRAVITY * L * (1 - Math.cos(s.theta));
    let s = start;
    for (let i = 0; i < 120 * 20; i++) s = hangStep(s, 0, NO_DRAG);
    expect(Math.abs(E(s) - E(start)) / E(start)).toBeLessThan(0.002);
  });
  it('pushing the way the body moves grows the swing, pushing against it shrinks it', () => {
    const start: Hang = { hold: 0, theta: 0.1, omega: 0 };
    const withIt = (s: Hang): -1 | 1 => (s.omega >= 0 ? 1 : -1);
    const against = (s: Hang): -1 | 1 => (s.omega >= 0 ? -1 : 1);
    const quiet = amplitude(start, 120 * 12, () => 0);
    const grown = amplitude(start, 120 * 12, withIt);
    expect(grown).toBeGreaterThan(quiet * 3);
    expect(grown).toBeGreaterThan(0.9); // a few swings of pumping from nearly still reach about 50 degrees
    // from a big swing, pushing against the motion takes energy out faster than leaving it alone
    const big: Hang = { hold: 0, theta: 0.9, omega: 0 };
    const late = (pump: (s: Hang) => -1 | 0 | 1) => { let st = big, m = 0; for (let i = 0; i < 120 * 8; i++) { st = hangStep(st, pump(st)); if (i > 120 * 6) m = Math.max(m, Math.abs(st.theta)); } return m; };
    expect(late(against)).toBeLessThan(late(() => 0));
  });
  it('a swing nobody pumps slowly dies down', () => {
    const start: Hang = { hold: 0, theta: 0.8, omega: 0 };
    let s = start;
    for (let i = 0; i < 120 * 30; i++) s = hangStep(s, 0);
    let late = 0;
    for (let i = 0; i < 120 * 3; i++) { s = hangStep(s, 0); late = Math.max(late, Math.abs(s.theta)); }
    expect(late).toBeLessThan(0.8 * 0.6);
  });
});

describe('grabbing and letting go', () => {
  const bar = [{ x: 10, y: 3 }];
  it('grabs only when the hands are within reach of the bar', () => {
    expect(tryGrab(bar, 10.1, 3 - DEFAULT_HANG.handHeight + 0.1, 5, 0)).not.toBeNull();
    expect(tryGrab(bar, 10, 3 - DEFAULT_HANG.handHeight - 1.0, 5, 0)).toBeNull();
    expect(tryGrab(bar, 11.2, 3 - DEFAULT_HANG.handHeight, 5, 0)).toBeNull();
  });
  it('keeps part of the speed on the catch (the arms absorb the rest)', () => {
    const g = tryGrab(bar, 10, 3 - DEFAULT_HANG.handHeight, 6, 0)!;
    expect(g.omega * DEFAULT_HANG.bodyLength).toBeCloseTo(6 * DEFAULT_HANG.catchKeep, 6);
  });
  it('the feet hang straight down from the bar at rest and swing out along an arc', () => {
    expect(feetOf(bar[0], { hold: 0, theta: 0, omega: 0 })).toEqual({ x: 10, y: 3 - DEFAULT_HANG.handHeight });
    const f = feetOf(bar[0], { hold: 0, theta: Math.PI / 2, omega: 0 });
    expect(f.x).toBeCloseTo(10 + DEFAULT_HANG.handHeight, 6);
    expect(f.y).toBeCloseTo(3, 6);
  });
  it('letting go flies on along the swing: at the bottom the body moves level', () => {
    const r = releaseHang(bar[0], { hold: 0, theta: 0, omega: 3 });
    expect(r.vx).toBeCloseTo(3 * DEFAULT_HANG.bodyLength, 6);
    expect(r.vy).toBeCloseTo(0, 6);
  });
});
