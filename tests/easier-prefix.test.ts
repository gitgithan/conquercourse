import { expect, it } from 'vitest';
import { prefixTrials } from '../scripts/easier-prefix';
import { playPlan, searchIdealRun } from '../src/sim/ideal';
import type { CourseData } from '../src/course/course';
const course: CourseData = { version: 1, name: 'prefix fixture', startX: 0, finishX: 24, jumpSpeed: 4.5, terrain: { waterY: -3, platforms: [{ x0: -2, x1: 10, top: 0 }, { x0: 14, x1: 28, top: 0 }] } };
it('replays exact full states and events while simulating the common prefix once', () => {
  const plan = searchIdealRun(course).plan;
  const plans = [-.3, 0, .3].map((dx) => ({ ...plan, jumpXs: [plan.jumpXs[0] + dx] }));
  const reuse = prefixTrials(course, plans);
  expect(reuse.runs).toEqual(plans.map((p) => playPlan(course, p)));
  expect(reuse.sharedTicks).toBeGreaterThan(0);
  expect(reuse.ticks).toBeLessThan(reuse.runs.reduce((n, r) => n + r.world.runner.tick, 0));
  expect(() => prefixTrials(course, [plans[0], { ...plans[1], releaseAfter: 35 }])).toThrow('Plans differ');
});
