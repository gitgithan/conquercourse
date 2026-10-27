import { describe, expect, it } from 'vitest';
import course from '../src/course/default-course.json';
import type { CourseData } from '../src/course/course';
import { courseFacts } from '../src/course/facts';

const C = course as unknown as CourseData;

describe('course facts follow the course data', () => {
  const f = courseFacts(C);
  it('lists every gap with its width and the speed it needs', () => {
    expect(f.gaps.length).toBeGreaterThanOrEqual(2);
    expect(f.gaps[0].width).toBeCloseTo(4.5, 6);
    expect(f.gaps[0].needed).toBeGreaterThan(4);
  });
  it('knows the wall height and the speed it needs', () => {
    expect(f.wall!.height).toBeCloseTo(4.3, 6);
    expect(f.wall!.needSpeed).toBeGreaterThan(4);
  });
  it('knows the trampoline drop, the far platform and the extra push needed', () => {
    expect(f.trampoline!.drop).toBeCloseTo(4.3, 6);
    expect(f.trampoline!.farRise).toBeCloseTo(4.0, 6);
    expect(f.trampoline!.extraNeeded).toBeGreaterThan(0);
    expect(f.trampoline!.extraNeeded).toBeLessThan(f.trampoline!.pump);
  });
  it('changes when the course changes (a wider first gap, a taller wall)', () => {
    const wider = JSON.parse(JSON.stringify(C)) as CourseData;
    wider.terrain.platforms[1].x0 += 2; wider.terrain.platforms[1].x1 += 2;
    wider.wall = { ...(wider.wall ?? { x0: 55 }), height: 5 };
    const g = courseFacts(wider);
    expect(g.gaps[0].width).toBeCloseTo(6.5, 6);
    expect(g.gaps[0].needed).toBeGreaterThan(f.gaps[0].needed);
    expect(g.wall!.needSpeed).toBeGreaterThan(f.wall!.needSpeed);
  });
});
