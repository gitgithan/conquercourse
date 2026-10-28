import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { DEMO_COURSE_FILES } from '../src/course/demo-list';
import { ROLL_FORGIVE_TICKS, ROLL_WINDOW_M, ROLL_WINDOW_S, rollWindowOpen } from '../src/sim/drop';
import { drumsFor } from '../src/sim/drums';
import { inputFor, type Plan } from '../src/sim/ideal';
import { NO_INPUT, type RunnerInput } from '../src/sim/runner';
import { newWorld, stepWorld, type WorldState } from '../src/sim/world';
import { generateCourse } from '../src/slice/generator';
import { predictJump } from '../src/sim/predict';

// The roll is required just before landing (CC-67): a press counts only inside the window of the last 0.15 s AND the last 1.2 m before touchdown.
// An earlier press does nothing (no hidden buffer: the landing is a normal one), a press up to 3 ticks after touchdown is forgiven.
const load = (f: string) => JSON.parse(readFileSync(f, 'utf8')) as CourseData;
const TICKS = Math.round(ROLL_WINDOW_S * 120);

// Plays a course's stored line; `rollAt(world)` decides the X press of each tick (the plan's own roll is replaced).
function play(c: CourseData, rollAt?: (w: WorldState) => boolean, maxTicks = 120 * 90) {
  const plan = c.plan as Plan;
  let w = newWorld(c);
  const st = { next: 0, caught: null as number | null, bedAt: null as number | null, hangAt: null as number | null, hangs: 0, vnext: 0 };
  const trace: { w: WorldState; open: boolean }[] = [];
  for (let i = 0; i < maxTicks && w.outcome === 'running'; i++) {
    const input: RunnerInput = { ...inputFor(plan, w, st, c) };
    const open = !w.runner.grounded && w.mode === 'run' && rollWindowOpen(w, c);
    if (rollAt) input.roll = rollAt(w); // an override replaces the plan's own press; without one the plan's line is played as it is
    trace.push({ w, open });
    w = stepWorld(w, input, c);
  }
  return { final: w, trace };
}

const courses: [string, CourseData][] = [
  ...DEMO_COURSE_FILES.map((f): [string, CourseData] => [f.split('/').pop()!, load(f)]),
  ...[1, 4, 9].map((s): [string, CourseData] => [`generated seed ${s}`, generateCourse(s)]),
];

describe('the roll window', () => {
  it('a landing needing the roll has its drum at the tick the window opens, and the window is the last 0.15 s and 1.2 m', () => {
    let checked = 0;
    for (const [name, c] of courses) {
      if (!c.plan) continue;
      const drums = drumsFor(c).filter((d) => d.what === 'roll');
      if (!drums.length) continue;
      // the drums come from the plan's own run; match each drum to a window start within 2 cm
      const planRun = play(c).trace;
      const opens: number[] = [];
      let wasOpen = false;
      planRun.forEach((t, k) => { if (t.w.runner.grounded) wasOpen = false; else if (t.open && !wasOpen) { opens.push(t.w.runner.x); wasOpen = true; } });
      for (const d of drums) {
        expect(opens.some((x) => Math.abs(x - d.x) < 0.02), `${name}: a roll drum at ${d.x.toFixed(2)} m is at a window start`).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(3); // the drop demo, both lache demos and others have landings that need the roll
  });
  it('the window is tight: when it opens, the ground is within 1.2 m and 0.15 s; one tick earlier it was not', () => {
    const c = load('public/assets/demo/drop.course.json');
    const { trace } = play(c);
    const k = trace.findIndex((t, i) => i > 0 && t.open && !trace[i - 1].open);
    expect(k).toBeGreaterThan(0);
    // the ticks until touchdown from the first open tick
    const land = trace.findIndex((t, i) => i > k && t.w.runner.grounded);
    expect(land - k).toBeLessThanOrEqual(TICKS + 1);
    expect(trace[k].w.runner.y - trace[land].w.runner.y).toBeLessThanOrEqual(ROLL_WINDOW_M + 0.1);
    const before = land - (k - 1), heightBefore = trace[k - 1].w.runner.y - trace[land].w.runner.y;
    expect(before > TICKS || heightBefore > ROLL_WINDOW_M).toBe(true); // one tick earlier it was too early by time or by height (the 5 m drop falls 1.2 m in about 0.13 s)
  });
  it('an early press at the ledge edge does not roll: the landing is normal, and the hard landing follows', () => {
    const c = load('public/assets/demo/drop.course.json');
    let pressed = false;
    const { final, trace } = play(c, (w) => { if (!pressed && !w.runner.grounded && w.runner.vy < 0) { pressed = true; return true; } return false; });
    expect(final.outcome).toBe('hurt');
    expect(final.rolledAt).toBe(-1000);
    expect(trace.some((t) => t.w.rollArmed)).toBe(false);
  });
  it('a press inside the window rolls and survives', () => {
    const c = load('public/assets/demo/drop.course.json');
    const { final } = play(c, (w) => !w.runner.grounded && w.mode === 'run' && rollWindowOpen(w, c));
    expect(final.outcome).toBe('cleared');
    expect(final.rolledAt).toBeGreaterThan(0);
  });
  it('a press up to 3 ticks after touchdown is forgiven; a later one is not', () => {
    const c = load('public/assets/demo/drop.course.json');
    const run = (delay: number) => {
      let landed = -1;
      return play(c, (w) => { if (landed < 0 && w.runner.landedAtTick !== null && w.runner.grounded && w.runner.tick > 200) landed = w.runner.tick; return landed >= 0 && w.runner.tick - landed === delay; }).final;
    };
    expect(ROLL_FORGIVE_TICKS).toBe(3);
    expect(run(2).outcome).toBe('cleared'); // 2 ticks after touchdown: forgiven, the landing was a roll
    expect(run(2).rolledAt).toBeGreaterThan(0);
    expect(run(8).outcome).toBe('hurt'); // 8 ticks after: too late
  });
  it('a roll on the ground still works, and X in the air outside the window does not start one', () => {
    const c = load('public/assets/demo/drop.course.json');
    let w = newWorld(c, 0);
    w = stepWorld(w, { ...NO_INPUT, roll: true }, c);
    expect(w.groundRoll).not.toBeNull();
  });
  it('the prediction from the ledge says it as it is: a hard landing without a roll, and when to press', () => {
    const c = load('public/assets/demo/drop.course.json');
    let w = newWorld(c, 0);
    for (let i = 0; i < 4000 && (w.runner.grounded || w.runner.x < 19); i++) w = stepWorld(w, { ...NO_INPUT, run: true, squat: true }, c);
    const pr = predictJump(w, c);
    expect(pr.result).toBe('hurt');
    expect(pr.why).toMatch(/last 0\.15 s/);
    expect(pr.why).toMatch(/earlier does nothing/);
  });
});
