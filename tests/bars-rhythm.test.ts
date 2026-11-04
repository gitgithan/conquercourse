import { describe, expect, it } from 'vitest';
import { barsStep, DEFAULT_BARS, type BarRun, type BarsHang } from '../src/sim/bars';

const run: BarRun = { x: 0, y: 2, n: 10, gap: 0.5 };
const hang = (over: Partial<BarsHang>): BarsHang => ({ run: 0, l: 0, r: 0, last: 0, pl: false, pr: false, theta: 0.5, omega: 1, ox: 0, oy: 0, et: 0, reaches: 0, ...over });

describe('the smooth chain on the monkey bars', () => {
  it('keeps more of the swing at each catch of an unbroken chain, and never more than it had', () => {
    const a = barsStep(hang({}), run, true, false, 0).s;
    expect(a.reaches).toBe(1);
    const b = barsStep(hang({ ...a, pl: false, pr: false, theta: 0.5, omega: 1 }), run, false, true, 0).s;
    expect(b.streak).toBe(2);
    // the second catch loses less speed than the first (same swing in), and neither catch adds speed
    const first = barsStep(hang({}), run, true, false, 0).s.omega, second = barsStep(hang({ ...a, theta: 0.5, omega: 1 }), run, false, true, 0).s.omega;
    expect(second).toBeGreaterThan(first);
    expect(second).toBeLessThanOrEqual(1.0001);
    expect(DEFAULT_BARS.keep + DEFAULT_BARS.rhythm * 100).toBeGreaterThan(1); // capped at 1 inside barsStep
  });
  it('a stall breaks the chain', () => {
    const s = barsStep(hang({ streak: 4, last: 1 }), run, true, false, 0).s; // the same hand twice: out of order
    expect(s.streak).toBe(0);
  });
});
