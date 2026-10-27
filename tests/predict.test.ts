import { describe, expect, it } from 'vitest';
import courseJson from '../src/course/default-course.json';
import type { CourseData } from '../src/course/course';
import { newWorld } from '../src/sim/world';
import { predictJump } from '../src/sim/predict';

const course = courseJson as unknown as CourseData;

describe('jump preview', () => {
  it('says a jump from the edge of the first gap lands, and one far too early falls in the water', () => {
    const first = course.terrain.platforms[0];
    let w = newWorld(course, first.x1 - 0.2);
    w = { ...w, runner: { ...w.runner, vx: 8 } };
    expect(predictJump(w, course).result).toBe('lands');
    let early = newWorld(course, first.x1 - 6);
    early = { ...early, runner: { ...early.runner, vx: 8 } };
    const r = predictJump(early, course);
    expect(['lands', 'splash']).toContain(r.result);
    expect(r.path.length).toBeGreaterThan(10);
  });
  it('does not change the world it was given', () => {
    const w = newWorld(course, 0);
    const before = JSON.stringify(w.runner);
    predictJump(w, course);
    expect(JSON.stringify(w.runner)).toBe(before);
  });
  it('explains in words', () => {
    expect(predictJump(newWorld(course, 0), course).why.length).toBeGreaterThan(10);
  });
});
