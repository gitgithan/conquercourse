import { describe, expect, it } from 'vitest';
import defaultCourse from '../src/course/default-course.json';
import type { CourseData } from '../src/course/course';
import { makeObstacle } from '../src/course/collide';

const course = defaultCourse as unknown as CourseData;
const hit = makeObstacle(course);
const wall = course.wall!;
const R = wall.radius ?? wall.height ?? 4.3;

describe('body points are kept out of blocks and the wall', () => {
  it('open air is free', () => expect(hit(5, 3)).toBeNull());
  it('standing on a platform is free', () => expect(hit(5, 0)).toBeNull());
  it('a point just under a platform top is lifted onto it', () => {
    const o = hit(5, -0.1)!;
    expect(o.dx).toBe(0);
    expect(o.dy).toBeGreaterThan(0.1);
  });
  it('a point deep inside the deck next to its face is pushed out sideways, not up', () => {
    const deckX0 = course.terrain.platforms.find((p) => p.x0 > wall.x0 + R - 0.5 && p.x0 < wall.x0 + R + 0.5)!.x0;
    const o = hit(deckX0 + 0.2, 3.5)!;
    expect(o.dx).toBeLessThan(0);
    expect(o.dy).toBe(0);
  });
  it('under the curve is solid, above it is free, and the push points toward the curve centre', () => {
    const x = wall.x0 + R * Math.sin(0.5), curveY = R * (1 - Math.cos(0.5));
    expect(hit(x, curveY + 0.3)).toBeNull();
    const o = hit(x, curveY - 0.3)!;
    expect(o.dx).toBeLessThan(0);
    expect(o.dy).toBeGreaterThan(0);
  });
  it('after the push a point is outside the curve', () => {
    const x = wall.x0 + 1.5, y = 0.1;
    const o = hit(x, y)!;
    expect(Math.hypot(x + o.dx - wall.x0, y + o.dy - R)).toBeLessThanOrEqual(R - 0.0);
  });
});
