import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { GROUND_ROLL_COST, GROUND_ROLL_KEEP, GROUND_ROLL_PUSH, GROUND_ROLL_RECOVERY, GROUND_ROLL_TIME } from '../src/sim/roll';
import { NO_INPUT } from '../src/sim/runner';
import { newWorld, stepWorld, type WorldState } from '../src/sim/world';

// The ground roll (X on the ground): from a stand it rolls a short way, running it keeps most of the speed, it never falls off an edge by accident.
const course = (edge = 60): CourseData => ({ version: 1, name: 'roll', startX: 0, finishX: 200, jumpSpeed: 4.5, terrain: { waterY: -8, platforms: [{ x0: -10, x1: edge, top: 0 }, { x0: edge + 8, x1: 200, top: 0 }] } });
const run = (w: WorldState, c: CourseData, ticks: number, input = NO_INPUT): WorldState => { for (let i = 0; i < ticks; i++) w = stepWorld(w, input, c); return w; };
const TICKS = Math.round(GROUND_ROLL_TIME * 120);

describe('the ground roll', () => {
  it('from standing it rolls about 1.5 to 2 m, ends on the feet and the runner can run on', () => {
    const c = course();
    let w = newWorld(c, 0);
    w = stepWorld(w, { ...NO_INPUT, roll: true }, c);
    expect(w.groundRoll).not.toBeNull();
    w = run(w, c, TICKS + 2);
    expect(w.groundRoll).toBeNull();
    expect(w.runner.grounded).toBe(true);
    expect(w.runner.x).toBeGreaterThan(1.4);
    expect(w.runner.x).toBeLessThan(2.0);
    expect(w.runner.vx).toBeGreaterThan(GROUND_ROLL_PUSH * GROUND_ROLL_KEEP * 0.9); // it ends with about the speed it kept (the feet skid a little)
    expect(w.runner.vx).toBeLessThan(GROUND_ROLL_PUSH);
    const after = run(w, c, 120, { ...NO_INPUT, run: true });
    expect(after.runner.x).toBeGreaterThan(w.runner.x + 3); // and the runner runs on
  });
  it('while running it keeps 85 % of the speed', () => {
    const c = course(150);
    let w = run(newWorld(c, 0), c, 240, { ...NO_INPUT, run: true });
    const v0 = w.runner.vx;
    expect(v0).toBeGreaterThan(5);
    w = stepWorld(w, { ...NO_INPUT, run: true, roll: true }, c);
    w = run(w, c, TICKS + 2, { ...NO_INPUT, run: true });
    expect(w.runner.vx / v0).toBeGreaterThan(0.84);
    expect(w.runner.vx / v0).toBeLessThan(0.9); // the sprint pulls the speed up a little after the roll
  });
  it('a roll that reaches an edge ends at the edge and the runner does not fall', () => {
    const c = course(1.0); // the platform ends one metre ahead
    let w = newWorld(c, 0);
    w = stepWorld(w, { ...NO_INPUT, roll: true }, c);
    w = run(w, c, TICKS + 30);
    expect(w.outcome).toBe('running');
    expect(w.runner.grounded).toBe(true);
    expect(w.runner.x).toBeLessThanOrEqual(1.0 + 1e-6);
    expect(w.runner.x).toBeGreaterThan(0.9);
  });
  it('cannot be started in the air, and the press only counts as the landing roll there', () => {
    const c = course();
    let w = newWorld(c, 0);
    w = stepWorld(w, { ...NO_INPUT, jump: true }, c);
    w = run(w, c, 100);
    expect(w.runner.grounded).toBe(false);
    w = stepWorld(w, { ...NO_INPUT, roll: true }, c); // pressed in the air, inside the window (about a twelfth of a second before the ground)
    expect(w.groundRoll).toBeNull();
    w = run(w, c, 120);
    expect(w.runner.grounded).toBe(true);
    expect(w.groundRoll).toBeNull(); // the held press did not start a roll along the ground after the landing roll
    expect(w.rolledAt).toBeGreaterThan(0); // it was the landing roll
  });
  it('is not a spam key: a second roll waits for the recovery and every roll costs a little energy', () => {
    const c = course(150);
    let w = newWorld(c, 0);
    w = stepWorld(w, { ...NO_INPUT, roll: true }, c);
    expect(w.energy).toBeCloseTo(1 - GROUND_ROLL_COST, 9);
    w = run(w, c, TICKS + 2);
    w = stepWorld(w, { ...NO_INPUT, roll: true }, c); // pressed again at once: too soon
    expect(w.groundRoll).toBeNull();
    w = run(w, c, Math.round(GROUND_ROLL_RECOVERY * 120) + 2);
    w = stepWorld(w, { ...NO_INPUT, roll: true }, c);
    expect(w.groundRoll).not.toBeNull();
  });
});
