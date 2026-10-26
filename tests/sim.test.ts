import { describe, expect, it } from 'vitest';
import { fallDistance } from '../src/sim/units';

describe('fall from rest', () => {
  it('drops about 4.9 m in one second on Earth', () => {
    expect(fallDistance(1)).toBeCloseTo(4.905, 3);
  });
  it('drops four times as far in twice the time', () => {
    expect(fallDistance(2)).toBeCloseTo(4 * fallDistance(1), 9);
  });
});
