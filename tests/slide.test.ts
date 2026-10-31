import { describe, expect, it } from 'vitest';
import { SLIDE_BODY_HIGH, SLIDE_DECEL, SLIDE_MIN_SPEED, SLIDE_RECOVERY, slideSpeed, startSlide } from '../src/sim/slide';
import { BODY_HIGH, charge, hitsBody, ballAt, type ShotLauncher } from '../src/sim/shots';
import { newWorld, stepWorld, type WorldState } from '../src/sim/world';
import { NO_INPUT } from '../src/sim/runner';
import { FLAT } from '../src/sim/terrain';
import type { CourseData } from '../src/course/course';
import { DT, GRAVITY } from '../src/sim/units';
import base from '../src/course/default-course.json';

const flat = { ...(base as unknown as CourseData), terrain: FLAT, startX: 0, checkpoints: [], shots: undefined } as CourseData;
const run = (w: WorldState, ticks: number, input = {}): WorldState => { for (let i = 0; i < ticks; i++) w = stepWorld(w, { ...NO_INPUT, run: true, ...input }, flat); return w; };
const fast = (): WorldState => run(newWorld(flat, 0), 600); // at top speed on the flat

describe('the slide: plain physics', () => {
  it('friction only takes speed away: the slide never speeds up and ends slower than it began', () => {
    let w = fast();
    const v0 = w.runner.vx;
    w = stepWorld(w, { ...NO_INPUT, run: true, slide: true }, flat);
    expect(w.slide).toBeTruthy();
    let last = v0;
    for (let i = 0; i < 60 && w.slide; i++) { w = stepWorld(w, { ...NO_INPUT, run: true }, flat); expect(w.runner.vx).toBeLessThanOrEqual(last + 1e-9); last = w.runner.vx; }
    expect(last).toBeLessThan(v0);
    expect(last).toBeGreaterThanOrEqual(0);
  });
  it('the speed falls by mu x g each second', () => {
    const g = startSlide({ ...fast().runner });
    expect(slideSpeed(g, 0.5)).toBeCloseTo(g.v0 - SLIDE_DECEL * 0.5, 9);
    expect(SLIDE_DECEL).toBeCloseTo(0.45 * GRAVITY, 9);
  });
  it('the energy of motion never grows (kinetic energy is only lost)', () => {
    let w = stepWorld(fast(), { ...NO_INPUT, run: true, slide: true }, flat);
    let ke = w.runner.vx ** 2;
    for (let i = 0; i < 200 && w.slide; i++) { w = stepWorld(w, { ...NO_INPUT }, flat); expect(w.runner.vx ** 2).toBeLessThanOrEqual(ke + 1e-9); ke = w.runner.vx ** 2; }
  });
  it('no slide in the air', () => {
    let w = stepWorld(fast(), { ...NO_INPUT, run: true, jump: true, jumpSpeed: 4.5 }, flat);
    w = stepWorld(w, { ...NO_INPUT, run: true, slide: true }, flat);
    expect(w.runner.grounded).toBe(false);
    expect(w.slide).toBeFalsy();
  });
  it('no slide when too slow', () => {
    const w = stepWorld(newWorld(flat, 0), { ...NO_INPUT, slide: true }, flat);
    expect(Math.abs(w.runner.vx)).toBeLessThan(SLIDE_MIN_SPEED);
    expect(w.slide).toBeFalsy();
  });
  it('a cooldown: a second slide cannot start until the recovery has passed', () => {
    let w = stepWorld(fast(), { ...NO_INPUT, run: true, slide: true }, flat);
    while (w.slide) w = stepWorld(w, { ...NO_INPUT, run: true }, flat);
    const readyAt = w.slideReadyAt!;
    expect(readyAt - w.runner.tick).toBeGreaterThan(SLIDE_RECOVERY * 120 - 3);
    const early = stepWorld(w, { ...NO_INPUT, run: true, slide: true }, flat);
    expect(early.slide).toBeFalsy();
  });
  it('a jump ends the slide', () => {
    let w = stepWorld(fast(), { ...NO_INPUT, run: true, slide: true }, flat);
    w = stepWorld(w, { ...NO_INPUT, run: true, jump: true, jumpSpeed: 4.5 }, flat);
    expect(w.slide).toBeFalsy();
  });
});

describe('the body has two heights', () => {
  const ball = (y: number) => ({ x: 10, y, r: 0.25 });
  it('a ball at head height hits a standing body and passes over a sliding one', () => {
    expect(hitsBody(ball(1.5), 10, 0)).toBe(true);
    expect(hitsBody(ball(1.5), 10, 0, true)).toBe(false);
  });
  it('a ball at knee height hits both: a slide does not dodge a low ball', () => {
    expect(hitsBody(ball(0.4), 10, 0)).toBe(true);
    expect(hitsBody(ball(0.4), 10, 0, true)).toBe(true);
  });
  it('the sliding body is lower than the standing one', () => {
    expect(SLIDE_BODY_HIGH).toBeLessThan(BODY_HIGH);
  });
  it('in a real run a head-high ball hurts a runner who stands and misses one who slides', () => {
    const L: ShotLauncher = { x: 30, y: 1.5, vx: -20, vy: 0, every: 100, phase: 0.2 };
    const c = { ...flat, shots: [L] } as CourseData;
    const go = (slide: boolean): string => {
      let w = stepWorld(fast(), { ...NO_INPUT, run: true, ...(slide ? { slide: true } : {}) }, c);
      w = { ...w, runner: { ...w.runner, x: 20, tick: 0 } };
      for (let i = 0; i < 360 && w.outcome === 'running'; i++) w = stepWorld(w, { ...NO_INPUT }, c);
      return w.outcome;
    };
    expect(go(false)).toBe('hurt');
    expect(go(true)).not.toBe('hurt');
  });
});

describe('the fire meter', () => {
  const L: ShotLauncher = { x: 50, y: 1, vx: -10, every: 10, phase: 4 };
  const tk = (s: number) => Math.round(s / DT);
  it('fills from 0 to 1 between two shots and fires the moment it is full', () => {
    expect(charge(L, tk(4) + 1)).toBeLessThan(0.01);
    expect(charge(L, tk(9))).toBeCloseTo(0.5, 2);
    expect(charge(L, tk(14))).toBeCloseTo(1, 2);
    expect(ballAt(L, 1, tk(14))).not.toBeNull(); // the ball leaves when the meter is full
    expect(ballAt(L, 1, tk(14) - 2)).toBeNull();
  });
  it('before the first shot it fills from the start of the run', () => {
    expect(charge(L, 0)).toBe(0);
    expect(charge(L, tk(2))).toBeCloseTo(0.5, 2);
    expect(charge(L, tk(4))).toBeCloseTo(1, 2);
  });
  it('the charge is only a function of the tick (the same on every replay)', () => {
    expect(charge(L, 1234)).toBe(charge(L, 1234));
  });
});

describe('a wall stops the ball', () => {
  it('a ball is gone once it reaches the wall face', () => {
    const L: ShotLauncher = { x: 50, y: 1, vx: -10, every: 100, phase: 0, stopX: 42 };
    expect(ballAt(L, 0, Math.round(0.5 / DT))).not.toBeNull();
    expect(ballAt(L, 0, Math.round(1 / DT))).toBeNull();
  });
});
