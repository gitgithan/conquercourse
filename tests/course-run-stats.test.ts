import { describe, expect, it } from 'vitest';
import { createRunStats } from '../src/modes/course/stats';
import type { CourseCtx } from '../src/modes/course/context';
import base from '../src/course/default-course.json';
import type { CourseData } from '../src/course/course';
import { newWorld } from '../src/sim/world';

const course = base as unknown as CourseData;
const make = () => {
  const st = { world: newWorld(course) } as unknown as CourseCtx['st'];
  const ctx: CourseCtx = { course, st, log: [], guides: {} as CourseCtx['guides'], specs: [], wallNeed: Infinity, everCleared: false, wallEntry: 0 };
  return { ctx, stats: createRunStats(ctx, 'attempt') };
};

describe('run statistics', () => {
  it('start with one attempt run counted and the first zone entered', () => {
    const { stats } = make();
    expect(stats.kind).toBe('attempt');
    expect(stats.summaries.attempt.runs).toBe(1);
    const zone = (course.zones?.length ? course.zones : [{ id: 'course' }])[0].id;
    expect(stats.summaries.attempt.obstacles[zone].attempts).toBe(1);
  });
  it('count a zone as cleared once, when the runner crosses its end', () => {
    const { stats } = make();
    const z = course.zones?.[0] ?? { id: 'course', x0: course.startX, x1: course.finishX };
    stats.updateRunProgress(z.x0 + 0.1);
    stats.updateRunProgress(z.x1 + 0.1);
    stats.updateRunProgress(z.x1 + 0.2);
    expect(stats.summaries.attempt.obstacles[z.id].successes).toBe(1);
  });
  it('close a run once: a second finish adds nothing', () => {
    const { ctx, stats } = make();
    ctx.st.world.runner.tick = 100;
    stats.finishRun(false, 'abcdefghij');
    stats.finishRun(false, 'abcdefghij');
    expect(stats.summaries.attempt.failures).toBe(1);
    expect(stats.summaries.attempt.ticks).toBe(100);
  });
  it('add up landings and bent landings', () => {
    const { stats } = make();
    stats.noteLanding(2, false); stats.noteLanding(3, true);
    expect(stats.summaries.attempt).toMatchObject({ landings: 2, landingOuch: 5, bentLandings: 1 });
  });
  it('a restart from a checkpoint is a practice run with fresh counts', () => {
    const { stats } = make();
    stats.noteLanding(2, false);
    stats.resetRunStats(course.startX + 5);
    expect(stats.kind).toBe('practice');
    expect(stats.summaries.practice.runs).toBe(1);
  });
});
