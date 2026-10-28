import { describe, expect, it } from 'vitest';
import { cartRides, fixCart } from '../src/slice/fixcart';

describe('Fix it for a coaster', () => {
  it('a track that already rolls home is left alone', () => {
    const r = fixCart([[0, 9], [7, 5], [14, 1], [22, 0.6], [34, 3.6], [46, 0.6], [56, 0.2]]);
    expect(r.ok).toBe(true);
    expect(r.steps).toEqual([]);
  });
  it('a first hill that is too low is raised (or the second one lowered) until the cart clears, and the fix is proved', () => {
    const bad: [number, number][] = [[0, 5], [8, 1], [18, 6.5], [30, 1], [42, 0.2]];
    expect(cartRides(bad)).toBe(false);
    const r = fixCart(bad);
    expect(r.ok).toBe(true);
    expect(r.steps.length).toBe(1);
    expect(cartRides(r.pts)).toBe(true);
  });
  it('a sharp hilltop is made broader, or the hill lowered, so the cart stays on the rails with no brake', () => {
    const bad: [number, number][] = [[0, 9], [7, 5], [14, 1], [22, 0.6], [27, 3.6], [32, 0.6], [46, 0.6], [56, 0.2]];
    expect(cartRides(bad)).toBe(false);
    const r = fixCart(bad);
    expect(r.ok).toBe(true);
    expect(cartRides(r.pts)).toBe(true);
    expect(r.steps[0]).toMatch(/broader|Lowered|Raised/);
  });
});
