import { describe, expect, it } from 'vitest';
import { progressZonesOf } from '../src/modes/course/zones';
import base from '../src/course/default-course.json';
import type { CourseData } from '../src/course/course';

const course = base as unknown as CourseData;

describe('progress zones of a course', () => {
  it('cover the course from the first zone to the finish, in order, without gaps', () => {
    const z = progressZonesOf(course);
    expect(z.length).toBeGreaterThan(0);
    expect(z[z.length - 1].x1).toBe(course.finishX);
    for (let i = 1; i < z.length; i++) expect(z[i - 1].x1).toBeLessThanOrEqual(z[i].x1);
  });
  it('fall back to one whole-course zone when nothing is found', () => {
    const bare = { ...course, terrain: { ...course.terrain, platforms: [] }, wall: undefined, rope: undefined, holds: undefined, trebuchet: undefined, recoil: undefined, track: undefined } as unknown as CourseData;
    expect(progressZonesOf(bare)).toEqual([{ id: 'course', name: course.name, x0: course.startX, x1: course.finishX }]);
  });
});
