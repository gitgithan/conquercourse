import { describe, expect, it } from 'vitest';
import { bottomLoad, comDistance, DEFAULT_HANG, feetOf, gripLoad, gripSlips, hangStep, measureHangPeriod, pendulumLength, releaseHang, tryGrab, type Hang } from '../src/sim/holds';
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

describe('over the top and round in full circles, up to the grip', () => {
  const E = (s: Hang) => 0.5 * s.omega * s.omega + (GRAVITY / pendulumLength(NO_DRAG)) * (1 - Math.cos(s.theta));
  // a rod hanging from one end needs omega^2 of 12 g d / H^2 at the bottom to get over the top
  const circleOmega = Math.sqrt((12 * GRAVITY * comDistance()) / DEFAULT_HANG.handHeight ** 2);
  const turns = (s0: Hang, seconds: number, p = NO_DRAG) => { let s = s0, flips = 0, prev = s0.theta; for (let i = 0; i < 120 * seconds; i++) { s = hangStep(s, 0, p); if (Math.abs(prev - s.theta) > Math.PI) flips++; prev = s.theta; } return { flips, end: s }; };
  it('started fast enough from the bottom, the body goes over the top again and again and keeps its energy', () => {
    const start: Hang = { hold: 0, theta: 0, omega: circleOmega * 1.05 };
    const r = turns(start, 20);
    expect(r.flips).toBeGreaterThanOrEqual(6);
    expect(Math.abs(E(r.end) - E(start)) / E(start)).toBeLessThan(0.002);
  });
  it('started a little too slow, it swings back before the top', () => {
    expect(turns({ hold: 0, theta: 0, omega: circleOmega * 0.95 }, 20).flips).toBe(0);
  });
  it('like the rope: fastest straight down, slowest at the top', () => {
    let s: Hang = { hold: 0, theta: 0, omega: circleOmega * 1.1 }, fast = 0, slow = Infinity;
    for (let i = 0; i < 120 * 6; i++) { s = hangStep(s, 0, NO_DRAG); if (Math.abs(s.theta) < 0.05) fast = Math.max(fast, Math.abs(s.omega)); if (Math.abs(s.theta) > 3.0) slow = Math.min(slow, Math.abs(s.omega)); }
    expect(fast).toBeGreaterThan(slow * 2);
  });
  it('the bar pulls with one body weight when hanging still, more as the swing speeds up', () => {
    expect(gripLoad({ hold: 0, theta: 0, omega: 0 })).toBeCloseTo(1, 9);
    expect(gripLoad({ hold: 0, theta: 0, omega: 4 })).toBeCloseTo(1 + (comDistance() * 16) / GRAVITY, 9);
    expect(bottomLoad({ hold: 0, theta: 0, omega: 4 })).toBeCloseTo(gripLoad({ hold: 0, theta: 0, omega: 4 }), 9);
  });
  it('pumping all the time builds the swing up to the grip and no further', () => {
    let s: Hang = { hold: 0, theta: 0.1, omega: 0 }, top = 0, circled = false;
    for (let i = 0; i < 120 * 30; i++) { s = hangStep(s, s.omega >= 0 ? 1 : -1); top = Math.max(top, Math.abs(gripLoad(s))); if (gripSlips(s)) break; if (Math.abs(s.theta) > 3.0) circled = true; }
    expect(gripSlips(s)).toBe(false);
    expect(top).toBeLessThanOrEqual(DEFAULT_HANG.grip);
    expect(top).toBeGreaterThan(0.9 * DEFAULT_HANG.grip);
    expect(circled).toBe(true); // a strong enough grip lets the pumped swing go all the way round
  });
  it('hands that hold less than four body weights cannot pump a full circle', () => {
    const weak = { ...DEFAULT_HANG, grip: 3.8 };
    let s: Hang = { hold: 0, theta: 0.1, omega: 0 }, circled = false;
    for (let i = 0; i < 120 * 30; i++) { s = hangStep(s, s.omega >= 0 ? 1 : -1, weak); if (Math.abs(s.theta) > 3.0) circled = true; }
    expect(circled).toBe(false);
  });
  it('the hands open when the bar pulls harder than they can hold', () => {
    expect(gripSlips({ hold: 0, theta: 0, omega: 8 })).toBe(true);
    expect(gripSlips({ hold: 0, theta: 0, omega: 2 })).toBe(false);
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
    expect(g.omega * comDistance()).toBeCloseTo(6 * DEFAULT_HANG.catchKeep, 6);
  });
  it('the feet hang straight down from the bar at rest and swing out along an arc', () => {
    expect(feetOf(bar[0], { hold: 0, theta: 0, omega: 0 })).toEqual({ x: 10, y: 3 - DEFAULT_HANG.handHeight });
    const f = feetOf(bar[0], { hold: 0, theta: Math.PI / 2, omega: 0 });
    expect(f.x).toBeCloseTo(10 + DEFAULT_HANG.handHeight, 6);
    expect(f.y).toBeCloseTo(3, 6);
  });
  it('letting go flies on along the swing: at the bottom the body moves level', () => {
    const r = releaseHang(bar[0], { hold: 0, theta: 0, omega: 3 });
    expect(r.vx).toBeCloseTo(3 * comDistance(), 6);
    expect(r.vy).toBeCloseTo(0, 6);
  });
  it('letting go on the way up throws the body along the swing: the speed is omega times the middle of the body', () => {
    const s: Hang = { hold: 0, theta: Math.PI / 4, omega: 5 };
    const r = releaseHang(bar[0], s);
    expect(Math.hypot(r.vx, r.vy)).toBeCloseTo(5 * comDistance(), 9);
    expect(r.vy / r.vx).toBeCloseTo(1, 9); // 45 degrees up
  });
});
