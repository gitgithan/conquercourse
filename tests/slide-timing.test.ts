import { describe, expect, it } from 'vitest';
import { newWorld, stepWorld, type WorldState } from '../src/sim/world';
import { NO_INPUT, type RunnerInput } from '../src/sim/runner';
import { FLAT } from '../src/sim/terrain';
import type { ShotLauncher } from '../src/sim/shots';
import { InputRecorder, inputOfMask, maskOf, verifyLog } from '../src/sim/replay';
import type { CourseData } from '../src/course/course';
import { DT, GRAVITY } from '../src/sim/units';
import base from '../src/course/default-course.json';

// A runner at top speed on a flat deck; one ball is lobbed so that it is at the top of its arc, at head height (1.5 m), exactly where the runner is 2.2 s later (so it flies level while it passes the body).
const flat = { ...(base as unknown as CourseData), terrain: FLAT, startX: 0, checkpoints: [], shots: undefined } as CourseData;
const T_MEET = 2.2, BALL_VX = -25;
const start = (): WorldState => {
  let w = newWorld(flat, 0);
  for (let i = 0; i < 600; i++) w = stepWorld(w, { ...NO_INPUT, run: true }, flat);
  return w;
};
const S0 = start(), V = S0.runner.vx, X0 = S0.runner.x, TICK0 = S0.runner.tick;
const L: ShotLauncher = { x: X0 + (V + Math.abs(BALL_VX)) * T_MEET, y: 1.5 - 0.5 * GRAVITY * T_MEET * T_MEET, vx: BALL_VX, vy: GRAVITY * T_MEET, every: 100, phase: TICK0 * DT };
const course = { ...flat, shots: [L] } as CourseData;

// The tick at which the ball reaches a runner who never slides.
function arrival(): number {
  let w = newWorld(course, 0);
  for (let i = 0; i < 1200 && w.outcome === 'running'; i++) w = stepWorld(w, { ...NO_INPUT, run: true }, course);
  return w.outcome === 'hurt' ? w.runner.tick : -1;
}
const HIT = arrival();

// press slide `offset` ticks before the standing runner would be hit (negative offset: after)
function play(offset: number | null, keys?: InputRecorder): WorldState {
  let w = newWorld(course, 0);
  const at = offset === null ? -1 : HIT - offset - 1;
  for (let i = 0; i < 1200 && w.outcome === 'running'; i++) {
    const input: RunnerInput = { ...NO_INPUT, run: true, ...(w.runner.tick === at ? { slide: true } : {}) };
    keys?.push(input);
    w = stepWorld(w, input, course);
  }
  return w;
}

describe('the cannon ball and the slide (real simulator)', () => {
  it('a runner who stands is hit', () => {
    expect(HIT).toBeGreaterThan(0);
    expect(play(null).outcome).toBe('hurt');
  });
  it('a slide that covers the moment the ball arrives passes under it', () => {
    for (const off of [30, 50, 70, 90]) expect(play(off).outcome, `slide ${off} ticks before`).not.toBe('hurt');
  });
  it('a slide pressed too early is over before the ball comes: hit', () => {
    expect(play(200).outcome).toBe('hurt'); // 1.7 s early: 0.9 s of slide and the body stands again
  });
  it('a slide pressed too late is a standing body: hit', () => {
    expect(play(-6).outcome).toBe('hurt');
    expect(play(-60).outcome).toBe('hurt');
  });
  it('the window is a real band, not a single tick: several press times pass, and it is bounded by the slide time', () => {
    const pass: number[] = [];
    for (let off = -20; off <= 140; off += 2) if (play(off).outcome !== 'hurt') pass.push(off);
    expect(pass.length).toBeGreaterThan(10);
    expect(Math.max(...pass) - Math.min(...pass)).toBeLessThanOrEqual(0.9 * 120 + 4);
  });
  it('the replay of the recorded keys gives the same outcome, time and place (the judge reproduces it)', () => {
    for (const off of [null, 40, 200]) {
      const rec = new InputRecorder();
      const w = play(off, rec);
      expect(rec.valid).toBe(true);
      const v = verifyLog(course, rec.snapshot());
      expect(v.world.outcome).toBe(w.outcome);
      expect(v.world.runner.tick).toBe(w.runner.tick);
      expect(v.world.runner.x).toBe(w.runner.x);
    }
  });
  it('the slide key is in the recorded mask and comes back out of it', () => {
    expect(inputOfMask(maskOf({ ...NO_INPUT, slide: true })).slide).toBe(true);
  });
});
