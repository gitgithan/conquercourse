import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { playPlan } from '../src/sim/ideal';

// CC-210: the film's hero course (Montmartre rooftops, then the proven rope section, one photo-lifted object) clears with its stored plan.
const c = JSON.parse(readFileSync('public/assets/demo/hero-montmartre-paris.course.json', 'utf8')) as CourseData;
describe('the hero course for the film', () => {
  const r = playPlan(c, c.plan!, 120 * 120);
  it('clears with its stored plan, on the ground at the finish', () => {
    expect(r.world.outcome).toBe('cleared');
    expect(r.world.runner.x).toBeGreaterThanOrEqual(c.finishX);
  });
  it('crosses the gap on the rope and has one lifted object on the lane', () => {
    expect(r.events.map((e) => e.type)).toContain('rope-catch');
    expect(c.scene?.length).toBe(1);
  });
});
