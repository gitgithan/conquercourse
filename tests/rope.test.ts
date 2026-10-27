import { describe, expect, it } from 'vitest';
import { GRAVITY } from '../src/sim/units';
import { DEFAULT_ROPE, measurePeriod, release, ropePoint, swingStep, tryCatch, type Swing } from '../src/sim/rope';

const near = (a: number, b: number, rel: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(rel * Math.abs(b));

describe('rope: honest catch', () => {
  // hands at x = 0 (the rope line), 4 m below the anchor: feet at y = 10 - 4 - 2.1
  it('catches when the hands meet the rope', () => {
    expect(tryCatch(DEFAULT_ROPE, 0.2, 10 - 4 - 2.1, 5, 0)).not.toBeNull();
  });
  it('does not catch when the hands are 0.5 m away from the rope', () => {
    expect(tryCatch(DEFAULT_ROPE, 0.5, 10 - 4 - 2.1, 5, 0)).toBeNull();
  });
  it('does not catch below the end of the rope or above the anchor', () => {
    expect(tryCatch(DEFAULT_ROPE, 0, 10 - 9.5 - 2.1, 5, 0)).toBeNull();
    expect(tryCatch(DEFAULT_ROPE, 0, 10, 5, 0)).toBeNull();
  });
  it('is a little more forgiving at the rope end (0.5 m)', () => {
    expect(tryCatch(DEFAULT_ROPE, 0.45, 10 - 8.8 - 2.1, 5, 0)).not.toBeNull();
  });
  it('a miss leaves the rope where it was: no rule moves it to the hands', () => {
    const before = ropePoint(DEFAULT_ROPE, 5);
    tryCatch(DEFAULT_ROPE, 0.9, 3, 5, 0);
    expect(ropePoint(DEFAULT_ROPE, 5)).toEqual(before);
  });
  it('the grip is where the hands met the rope, and the speed along the swing carries on', () => {
    const sw = tryCatch(DEFAULT_ROPE, 0, 10 - 5 - 2.1, 6, 0)!;
    near(sw.grip, 5, 1e-9);
    near(sw.omega * sw.grip, 6, 1e-9);
  });
});

describe('rope: pendulum', () => {
  it('the period is 2 pi root(L/g) for a small swing, within 1 %', () => {
    for (const L of [3, 5.3, 9]) near(measurePeriod(L, 0.05), 2 * Math.PI * Math.sqrt(L / GRAVITY), 0.01);
  });
  it('a bigger swing is slower: period grows by about theta0² / 16', () => {
    const L = 5;
    near(measurePeriod(L, 0.8), 2 * Math.PI * Math.sqrt(L / GRAVITY) * (1 + 0.8 * 0.8 / 16), 0.01);
  });
  it('conserves energy: the same height is reached on the far side', () => {
    let sw: Swing = { grip: 5, theta: 0.9, omega: 0 };
    let maxOpposite = 0;
    for (let i = 0; i < 120 * 6; i++) { sw = swingStep(sw); maxOpposite = Math.min(maxOpposite, sw.theta); }
    near(-maxOpposite, 0.9, 0.005);
  });
  it('release flies along the swing: at the bottom the speed is horizontal and equals omega x grip', () => {
    const r = release(DEFAULT_ROPE, { grip: 5, theta: 0, omega: 1.2 });
    near(r.vx, 6, 1e-9);
    expect(Math.abs(r.vy)).toBeLessThan(1e-9);
  });
  it('letting go on the upswing sends the runner up, on the downswing down', () => {
    expect(release(DEFAULT_ROPE, { grip: 5, theta: 0.5, omega: 1 }).vy).toBeGreaterThan(0);
    expect(release(DEFAULT_ROPE, { grip: 5, theta: 0.5, omega: -1 }).vy).toBeLessThan(0);
  });
});

