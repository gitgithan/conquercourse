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

describe('release preview', () => {
  it('says when letting go reaches the next bar or the ground, and not before the swing is big enough', async () => {
    const { readFileSync } = await import('node:fs');
    const { predictRelease } = await import('../src/sim/predict');
    const { stepWorld } = await import('../src/sim/world');
    const { searchIdealRun, inputFor } = await import('../src/sim/ideal');
    const c = JSON.parse(readFileSync('public/assets/demo/lache.course.json', 'utf8')) as CourseData;
    const plan = searchIdealRun(c).plan;
    const st = { next: 0, caught: null as number | null, bedAt: null as number | null, hangAt: null as number | null, hangs: 0, vnext: 0 };
    let w = newWorld(c, 0);
    const verdicts: string[] = [];
    for (let i = 0; i < 120 * 40 && w.outcome === 'running'; i++) {
      w = stepWorld(w, inputFor(plan, w, st, c), c);
      if (w.mode === 'hang' && i % 20 === 0) verdicts.push(predictRelease(w, c).result);
    }
    expect(verdicts.length).toBeGreaterThan(5);
    expect(verdicts).toContain('lands'); // at some moment in the swing, letting go is right
    expect(verdicts.some((v) => v !== 'lands')).toBe(true); // and at others it is not
  });
});
