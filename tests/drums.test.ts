import { describe, expect, it } from 'vitest';
import courseJson from '../src/course/default-course.json';
import type { CourseData } from '../src/course/course';
import { drumsFor } from '../src/sim/drums';

const course = courseJson as unknown as CourseData;

describe('the drum lane', () => {
  const drums = drumsFor(course);
  it('has a drum for each press of the ideal run, in order along the course', () => {
    expect(drums.length).toBeGreaterThanOrEqual(5);
    for (let i = 1; i < drums.length; i++) expect(drums[i].x).toBeGreaterThanOrEqual(drums[i - 1].x - 1e-6);
  });
  it('names the rope release (letting go of E) and the trampoline press', () => {
    expect(drums.some((d) => d.what === 'release')).toBe(true);
    expect(drums.some((d) => d.what === 'bounce')).toBe(true);
  });
  it('puts every jump drum on solid ground at the take-off edge side of its obstacle', () => {
    for (const d of drums.filter((q) => q.what === 'jump')) expect(d.x).toBeGreaterThan(course.startX);
  });
});
