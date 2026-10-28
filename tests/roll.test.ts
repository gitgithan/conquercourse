import { describe, expect, it } from 'vitest';
import { DEFAULT_LANDING, landing, safeDrop } from '../src/sim/landing';
import { GRAVITY } from '../src/sim/units';
import { DEFAULT_PARAMS, NO_INPUT, startState, step, type RunnerInput } from '../src/sim/runner';
import { newWorld, stepWorld, type WorldState } from '../src/sim/world';
import type { CourseData } from '../src/course/course';
import type { Terrain } from '../src/sim/terrain';
import { LANE_DROP, ROLL_SURVIVE_DROP, SQUAT_CLEAN_DROP, rollNeeded } from '../src/sim/drop';

const speedFor = (h: number) => Math.sqrt(2 * GRAVITY * h);
const dropCourse = (h: number): CourseData => ({
  version: 1, name: 'drop', startX: 0, finishX: 60, jumpSpeed: 4.5,
  terrain: { waterY: -h - 3, platforms: [{ x0: -10, x1: 10, top: h }, { x0: 10.001, x1: 80, top: 0 }] },
});
// Run off the edge of a high deck and land; `press` decides which landing input is used.
function fall(h: number, input: Partial<RunnerInput>, rollAt: 'early' | 'late' | 'never' = 'never'): WorldState {
  const c = dropCourse(h);
  let w = newWorld(c, 4);
  w.runner = { ...w.runner, x: 4, y: h, vx: 7 };
  let after = 0; // a stumble or hard landing waits 3 ticks for a forgiven press, so play a few ticks past the touchdown
  for (let i = 0; i < 120 * 8 && w.outcome === 'running' && after < 6; i++) {
    if (w.runner.landing && w.runner.grounded && w.runner.x > 10) after++;
    const airborne = !w.runner.grounded;
    const near = airborne && w.runner.y < 1.2;
    const press = rollAt === 'late' ? near : rollAt === 'early' ? airborne && w.runner.y > h - 0.05 : false;
    w = stepWorld(w, { ...NO_INPUT, run: true, ...input, roll: press }, c);
  }
  return w;
}

describe('landing physics: stop time and stop distance (CC-56)', () => {
  it('the same speed change over more time is a gentler push', () => {
    const v = speedFor(2);
    expect(landing(v, true).peakDecel).toBeLessThan(landing(v, false).peakDecel);
    expect(landing(v, false, DEFAULT_LANDING, true).peakDecel).toBeLessThan(landing(v, true).peakDecel);
  });
  it('the body cannot stop over more room than it has: a big fall is stopped harder than the soft-landing time says', () => {
    const v = speedFor(8);
    const timeOnly = v / DEFAULT_LANDING.squatStopTime;
    expect(landing(v, true).peakDecel).toBeGreaterThan(timeOnly);
  });
  it('the limits come from the same numbers (written in docs/world-slice.md)', () => {
    const stiff = safeDrop('stiff'), squat = safeDrop('squat'), roll = safeDrop('roll');
    expect(stiff.survive).toBeGreaterThan(2); expect(stiff.survive).toBeLessThan(3);
    expect(squat.clean).toBeGreaterThan(3); expect(squat.clean).toBeLessThan(4.2);
    expect(squat.survive).toBeGreaterThan(4); expect(squat.survive).toBeLessThan(6);
    expect(roll.survive).toBeGreaterThan(8); expect(roll.survive).toBeLessThan(12);
    expect(roll.survive).toBeGreaterThan(squat.survive * 1.5);
    expect(SQUAT_CLEAN_DROP).toBeCloseTo(squat.clean);
    expect(ROLL_SURVIVE_DROP).toBeCloseTo(roll.survive);
    expect(LANE_DROP).toBeLessThan(ROLL_SURVIVE_DROP);
  });
  it('the limits agree with the landing report at the edge', () => {
    for (const [style, squat, rolled] of [['stiff', false, false], ['squat', true, false], ['roll', false, true]] as const) {
      const { survive } = safeDrop(style);
      expect(landing(speedFor(survive * 0.98), squat, DEFAULT_LANDING, rolled).hurt).toBe(false);
      expect(landing(speedFor(survive * 1.05), squat, DEFAULT_LANDING, rolled).hurt).toBe(true);
    }
  });
});

describe('roll in the world (CC-56)', () => {
  const small = (h: number) => fall(h, { squat: true });
  it('drops of 1 and 3 m are clean with bent knees', () => {
    expect(small(1).outcome).toBe('running');
    expect(small(1).runner.landing!.stumbled).toBe(false);
    expect(small(3).outcome).toBe('running');
    expect(small(3).runner.landing!.stumbled).toBe(false);
  });
  it('a 3 m drop without bending the knees ends the run (hard landing, not water)', () => {
    const w = fall(3, { squat: false });
    expect(w.outcome).toBe('hurt');
    expect(w.events.some((e) => e.type === 'hard-landing')).toBe(true);
    expect(w.runner.splashed).toBe(false);
  });
  it('a 5 m drop ends the run with bent knees and is survived by a roll', () => {
    const knees = fall(5, { squat: true });
    expect(knees.outcome).toBe('hurt');
    const rolled = fall(5, { squat: true }, 'late');
    expect(rolled.outcome).toBe('running');
    expect(rolled.runner.landing!.rolled).toBe(true);
  });
  it('a roll keeps most of the forward speed; a stumble loses most of it', () => {
    const rolled = fall(4, { squat: true }, 'late');
    const stumble = fall(4.3, { squat: true });
    expect(rolled.runner.vx).toBeGreaterThan(7 * 0.8);
    expect(stumble.runner.landing!.stumbled).toBe(true);
    expect(stumble.runner.vx).toBeLessThan(7 * 0.5);
  });
  it('an 8 m drop is survived only by a roll', () => {
    expect(fall(8, { squat: true }).outcome).toBe('hurt');
    expect(fall(8, { squat: true }, 'late').outcome).toBe('running');
  });
  it('a drop past the roll limit still ends the run', () => {
    expect(fall(ROLL_SURVIVE_DROP + 1.5, { squat: true }, 'late').outcome).toBe('hurt');
  });
  it('a roll counts only inside the window (the last 0.15 s and 1.2 m); a press a quarter of a second early or at the edge is ignored', () => {
    const c = dropCourse(5);
    const run = (pressAtY: number) => {
      let w = newWorld(c, 4);
      w.runner = { ...w.runner, x: 4, y: 5, vx: 7 };
      let pressed = false;
      let after = 0;
      for (let i = 0; i < 120 * 6 && w.outcome === 'running' && after < 6; i++) {
        if (w.runner.landing && w.runner.grounded && w.runner.x > 10) after++;
        const press = !pressed && !w.runner.grounded && w.runner.y <= pressAtY;
        if (press) pressed = true;
        w = stepWorld(w, { ...NO_INPUT, run: true, squat: true, roll: press }, c);
      }
      return w;
    };
    expect(run(1.0).outcome).toBe('running'); // pressed about 0.1 s before the ground: inside the window
    expect(run(2.5).outcome).toBe('hurt'); // pressed about a quarter of a second before the ground: ignored, no hidden buffer
    expect(run(4.9).outcome).toBe('hurt'); // pressed at the edge, long before the ground
  });
  it('rollNeeded says so only for a fall a squat cannot take cleanly, close to the ground', () => {
    const c = dropCourse(6);
    let w = newWorld(c, 4);
    w.runner = { ...w.runner, x: 4, y: 6, vx: 7 };
    let needed = false, early = false;
    for (let i = 0; i < 120 * 4 && !(w.runner.grounded && w.runner.x > 10); i++) {
      w = stepWorld(w, { ...NO_INPUT, run: true, squat: true }, c);
      if (!w.runner.grounded && w.runner.y > 3) early = early || rollNeeded(w, c);
      if (!w.runner.grounded && w.runner.y < 1) needed = needed || rollNeeded(w, c);
    }
    expect(early).toBe(false);
    expect(needed).toBe(true);
    const small = dropCourse(1.5);
    let w2 = newWorld(small, 4);
    w2.runner = { ...w2.runner, x: 4, y: 1.5, vx: 7 };
    let any = false;
    for (let i = 0; i < 120 * 3; i++) { w2 = stepWorld(w2, { ...NO_INPUT, run: true, squat: true }, small); any = any || rollNeeded(w2, small); }
    expect(any).toBe(false);
  });
  it('a roll on the ground does nothing, and the runner state step is untouched by it', () => {
    const t: Terrain = { platforms: [{ x0: -10, x1: 100, top: 0 }], waterY: -1 };
    const a = step(startState(), { ...NO_INPUT, run: true, roll: true }, DEFAULT_PARAMS, t);
    const b = step(startState(), { ...NO_INPUT, run: true }, DEFAULT_PARAMS, t);
    expect(a).toEqual(b);
  });
});
