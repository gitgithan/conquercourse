import { describe, expect, it } from 'vitest';
import { GRAVITY } from '../src/sim/units';
import { DEFAULT_TRAMPOLINE, bounce } from '../src/sim/trampoline';

const near = (a: number, b: number, rel: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(rel * Math.abs(b));

describe('trampoline', () => {
  const lossless = { ...DEFAULT_TRAMPOLINE, damping: 0 };
  it('with no damping the feet leave at the speed they arrived', () => {
    for (const v of [2, 4, 6]) near(bounce(v, lossless).vyOut, v, 0.01);
  });
  it('rebound height matches the stored spring energy: 1/2 k x² = 1/2 v² + g x at the deepest point', () => {
    const v = 5;
    const b = bounce(v, lossless);
    near(0.5 * lossless.stiffness * b.maxCompression ** 2, 0.5 * v * v + GRAVITY * b.maxCompression, 0.01);
  });
  it('damping loses energy: a lower bounce than the drop', () => {
    expect(bounce(5).vyOut).toBeLessThan(5);
  });
  it('the harder you land, the higher it throws you', () => {
    expect(bounce(6).vyOut).toBeGreaterThan(bounce(3).vyOut);
  });
  it('a press at the deepest point adds speed; a press far from it adds nothing', () => {
    const base = bounce(5);
    const deepestTick = base.path.indexOf(Math.min(...base.path));
    const timed = bounce(5, DEFAULT_TRAMPOLINE, deepestTick);
    const early = bounce(5, DEFAULT_TRAMPOLINE, 0);
    expect(timed.vyOut).toBeCloseTo(base.vyOut + DEFAULT_TRAMPOLINE.pump, 9);
    expect(early.vyOut).toBeCloseTo(base.vyOut, 9);
  });
  it('never returns more energy than it was given without a press', () => {
    for (const v of [1, 3, 5, 8]) expect(bounce(v).vyOut).toBeLessThanOrEqual(v + 1e-6);
  });
});
