import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { fieldsOk } from '../src/course/schema';
import { inputOfMask, verifyLog, type InputLog } from '../src/sim/replay';
import { newWorld, stepWorld } from '../src/sim/world';

// The ideal-run search does not know monkey bars (docs/bars.md), so this course is proved by a recorded run: the keys play again to the finish.
const course = JSON.parse(readFileSync('public/assets/demo/bars.course.json', 'utf8')) as CourseData;
const run = JSON.parse(readFileSync('public/assets/demo/bars.run.json', 'utf8')) as { log: InputLog; ticks: number };

describe('the monkey bars demo course', () => {
  it('passes the course schema', () => { expect(fieldsOk(course as unknown as Record<string, unknown>)).toBe(true); });
  it('the recorded keys clear it, in the ticks they were recorded with', () => {
    const v = verifyLog(course, run.log);
    expect(v.cleared).toBe(true);
    expect(v.ticks).toBe(run.ticks);
  });
  it('the run goes along every rung: one reach per rung, one grab, one release', () => {
    let w = newWorld(course);
    const count: Record<string, number> = {};
    const hands: Record<number, number> = {};
    for (const [m, n] of run.log) for (let k = 0; k < n; k++) {
      w = stepWorld(w, inputOfMask(m), course);
      for (const e of w.events) { count[e.type] = (count[e.type] ?? 0) + 1; if (e.type === 'bars-reach') hands[e.detail!.hand as number] = (hands[e.detail!.hand as number] ?? 0) + 1; }
    }
    expect(count['bars-grab']).toBe(1);
    expect(count['bars-release']).toBe(1);
    const n = course.bars![0].n; // leapfrog: one reach per rung, the hands taking turns
    expect(hands).toEqual({ 1: Math.ceil(n / 2), 2: Math.floor(n / 2) });
  });
  it('cannot be cleared without the bars: the same keys, with the bars removed, fall in the water', () => {
    const v = verifyLog({ ...course, bars: undefined }, run.log);
    expect(v.cleared).toBe(false);
  });
});
