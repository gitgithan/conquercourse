import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { inputFor, playPlan, searchIdealRun } from '../src/sim/ideal';
import { newWorld, stepWorld } from '../src/sim/world';

const course = JSON.parse(readFileSync('public/assets/demo/drop.course.json', 'utf8')) as CourseData;

describe('the big drop demo (CC-56)', () => {
  it('the ideal run clears it and rolls out of the 5 m drop', () => {
    const { plan, cleared } = searchIdealRun(course);
    expect(cleared).toBe(true);
    const r = playPlan(course, plan);
    expect(r.world.outcome).toBe('cleared');
    expect(r.events.some((e) => e.type === 'land' && e.detail?.rolled === true)).toBe(true);
  });
  it('the same run without a roll is a hard landing', () => {
    const { plan } = searchIdealRun(course);
    let w = newWorld(course);
    const st = { next: 0, caught: null as number | null, bedAt: null as number | null };
    for (let i = 0; i < 120 * 40 && w.outcome === 'running'; i++) w = stepWorld(w, inputFor(plan, w, st), course); // no course given: the plan never rolls
    expect(w.outcome).toBe('hurt');
  });
});
