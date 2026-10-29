import { describe, expect, it } from 'vitest';
import { gaugePercent } from '../src/ui/gauges';

describe('character gauges (CC-148)', () => {
  it('keeps the fill inside 0..100', () => {
    expect(gaugePercent(5, 10)).toBe(50);
    expect(gaugePercent(-3, 10)).toBe(0);
    expect(gaugePercent(30, 10)).toBe(100);
  });
  it('treats a bad number or a zero max as empty', () => {
    expect(gaugePercent(NaN, 10)).toBe(0);
    expect(gaugePercent(4, 0)).toBe(0);
  });
});
