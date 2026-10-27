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
  it('a press at the deepest point adds the full push; a press long before or after adds nothing', () => {
    const base = bounce(5);
    const deepestTick = base.path.indexOf(Math.min(...base.path));
    expect(bounce(5, DEFAULT_TRAMPOLINE, deepestTick).vyOut).toBeCloseTo(base.vyOut + DEFAULT_TRAMPOLINE.pump, 9);
    expect(bounce(5, DEFAULT_TRAMPOLINE, deepestTick + 40).vyOut).toBeCloseTo(base.vyOut, 9);
  });
  it('a press a little off the bottom adds part of the push (a forgiving window)', () => {
    const base = bounce(5);
    const deepestTick = base.path.indexOf(Math.min(...base.path));
    const part = bounce(5, DEFAULT_TRAMPOLINE, deepestTick + 12);
    expect(part.vyOut).toBeGreaterThan(base.vyOut);
    expect(part.vyOut).toBeLessThan(base.vyOut + DEFAULT_TRAMPOLINE.pump);
  });
  it('never returns more energy than it was given without a press', () => {
    for (const v of [1, 3, 5, 8]) expect(bounce(v).vyOut).toBeLessThanOrEqual(v + 1e-6);
  });
});

describe('what the Course asks of the trampoline (R3-G1)', () => {
  it('without a press the 4.3 m drop does not reach the 4.0 m platform; a full press does', () => {
    const vIn = Math.sqrt(2 * GRAVITY * 4.3);
    const base = bounce(vIn).vyOut;
    expect((base * base) / (2 * GRAVITY)).toBeLessThan(4.0);
    const full = bounce(vIn, DEFAULT_TRAMPOLINE, bounce(vIn).path.indexOf(Math.min(...bounce(vIn).path))).vyOut;
    expect((full * full) / (2 * GRAVITY)).toBeGreaterThan(4.3);
  });
  it('a rough press (about 100 ms off the bottom) is still enough', () => {
    const vIn = Math.sqrt(2 * GRAVITY * 4.3);
    const deepest = bounce(vIn).path.indexOf(Math.min(...bounce(vIn).path));
    const rough = bounce(vIn, DEFAULT_TRAMPOLINE, deepest + 8).vyOut; // about 70 ms late
    expect((rough * rough) / (2 * GRAVITY)).toBeGreaterThan(4.0);
  });
});
