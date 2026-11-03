import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { fieldsOk } from '../src/course/schema';
import { inputOfMask, verifyLog, type InputLog } from '../src/sim/replay';
import { newWorld, stepWorld } from '../src/sim/world';

// A pull-up bar, then a row of monkey bars (docs/bars.md). The ideal-run search does not know monkey bars, so the recorded keys are the proof.
const course = JSON.parse(readFileSync('public/assets/demo/swing-to-bars.course.json', 'utf8')) as CourseData;
const run = JSON.parse(readFileSync('public/assets/demo/swing-to-bars.run.json', 'utf8')) as { log: InputLog; ticks: number };

describe('the pull-up bar to monkey bars demo course', () => {
  it('passes the course schema', () => { expect(fieldsOk(course as unknown as Record<string, unknown>)).toBe(true); });
  it('the recorded keys clear it, in the ticks they were recorded with', () => {
    const v = verifyLog(course, run.log);
    expect(v.cleared).toBe(true);
    expect(v.ticks).toBe(run.ticks);
  });
  it('the run hangs from the bar, lets go, then takes the row: a bar grab, then a bars grab, five reaches of each hand', () => {
    let w = newWorld(course);
    const order: string[] = [];
    const hands: Record<number, number> = {};
    for (const [m, n] of run.log) for (let k = 0; k < n; k++) {
      w = stepWorld(w, inputOfMask(m), course);
      for (const e of w.events) {
        if (e.type === 'hang-catch' || e.type === 'bars-grab' || e.type === 'hang-release' || e.type === 'bars-release') order.push(e.type);
        if (e.type === 'bars-reach') hands[e.detail!.hand as number] = (hands[e.detail!.hand as number] ?? 0) + 1;
      }
    }
    expect(order).toEqual(['hang-catch', 'hang-release', 'bars-grab', 'bars-release']);
    expect(hands).toEqual({ 1: 5, 2: 5 });
  });
  it('needs both: without the row the same keys fall, and without the bar they never get started', () => {
    expect(verifyLog({ ...course, bars: undefined }, run.log).cleared).toBe(false);
    expect(verifyLog({ ...course, holds: undefined }, run.log).cleared).toBe(false);
  });
});
