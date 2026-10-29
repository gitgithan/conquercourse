import { describe, expect, it } from 'vitest';
import { MIN_POINTS, resamplePath } from '../src/ui/run-report';

describe('end-report path (CC-173)', () => {
  it('gives a two-point path enough points, ending where it ended', () => {
    const p = resamplePath([{ x: 0, y: 0 }, { x: 10, y: 4 }]);
    expect(p.length).toBeGreaterThanOrEqual(MIN_POINTS);
    expect(p[0]).toEqual({ x: 0, y: 0 });
    expect(p[p.length - 1]).toEqual({ x: 10, y: 4 });
  });
  it('follows the bend of a short path instead of cutting across it', () => {
    const p = resamplePath([{ x: 0, y: 0 }, { x: 5, y: 3 }, { x: 10, y: 0 }]);
    expect(p.length).toBeGreaterThanOrEqual(MIN_POINTS);
    expect(Math.max(...p.map((q) => q.y))).toBe(3);
  });
  it('leaves a dense path alone', () => {
    const dense = Array.from({ length: 40 }, (_, i) => ({ x: i, y: Math.sin(i) }));
    expect(resamplePath(dense)).toBe(dense);
  });
});
