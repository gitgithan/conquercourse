import { describe, expect, it } from 'vitest';
import course from '../src/course/default-course.json';
import type { CourseData } from '../src/course/course';
import { gapSpecs, minSpeedToCross } from '../src/sim/needs';

const C = course as unknown as CourseData;

describe('the speed a gap needs', () => {
  it('a flat gap needs speed = width x g / (2 x push), within 1 %', () => {
    const v = minSpeedToCross(5, 0, 4.5);
    expect(Math.abs(v - (5 * 9.81) / (2 * 4.5))).toBeLessThan(0.01 * v);
  });
  it('a wider gap needs more speed; landing higher needs more than landing level', () => {
    expect(minSpeedToCross(6, 0, 4.5)).toBeGreaterThan(minSpeedToCross(4, 0, 4.5));
    expect(minSpeedToCross(4, 0.5, 4.5)).toBeGreaterThan(minSpeedToCross(4, 0, 4.5));
  });
  it('every gap of the default course can be crossed at the runner top speed', () => {
    for (const g of gapSpecs(C)) expect(g.needed).toBeLessThan(9);
  });
  it('the first gap is easy: it needs well under the speed reached by x = 30 m', () => {
    expect(gapSpecs(C)[0].needed).toBeLessThan(6);
  });
});
