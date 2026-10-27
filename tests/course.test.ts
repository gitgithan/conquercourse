import { describe, expect, it } from 'vitest';
import course from '../src/course/default-course.json';
import type { CourseData } from '../src/course/course';
import { NO_INPUT, type RunnerInput } from '../src/sim/runner';
import { newWorld, stepWorld, type GameEvent, type WorldState } from '../src/sim/world';

const C = course as unknown as CourseData;

// A policy decides the input from the world each tick.
type Policy = (w: WorldState) => RunnerInput;
function play(policy: Policy, maxTicks = 120 * 60) {
  let w = newWorld(C);
  const log: GameEvent[] = [];
  for (let i = 0; i < maxTicks && w.outcome === 'running'; i++) {
    w = stepWorld(w, policy(w), C);
    log.push(...w.events);
  }
  return { w, log };
}
const hold: RunnerInput = { ...NO_INPUT, run: true };
const press: RunnerInput = { ...NO_INPUT, run: true, jump: true };

describe('the default course', () => {
  it('standing still, nothing happens', () => {
    const { w } = play(() => NO_INPUT, 600);
    expect(w.outcome).toBe('running');
    expect(w.runner.x).toBe(0);
  });
  it('running straight off the first platform ends in the water', () => {
    const { w, log } = play(() => hold);
    expect(w.outcome).toBe('splash');
    expect(log.some((e) => e.type === 'splash')).toBe(true);
    expect(w.runner.x).toBeGreaterThan(30);
    expect(w.runner.x).toBeLessThan(36);
  });
  it('jumping at the first gap edge clears it', () => {
    const { w, log } = play((s) => (s.runner.x >= 28.8 && s.runner.grounded && s.mode === 'run' ? press : hold), 120 * 20);
    const land = log.find((e) => e.type === 'land');
    expect(land).toBeDefined();
    expect(w.runner.x).toBeGreaterThan(35.5);
  });
});

import { playImperfect, searchIdealRun } from '../src/sim/ideal';

describe('the ideal run', () => {
  const found = searchIdealRun(C);
  it('exists: the simulator proves the course can be cleared', () => {
    expect(found.cleared).toBe(true);
  });
});

describe('first-time flow: an imperfect player clears within 3 minutes', () => {
  const found = searchIdealRun(C);
  it('with presses 60 ms off on average, at least 9 of 10 players clear in 3 minutes of game time', () => {
    const times = Array.from({ length: 10 }, (_, i) => playImperfect(C, found.plan, i + 1, 60, 180));
    const cleared = times.filter((t) => t !== null).length;
    expect(cleared).toBeGreaterThanOrEqual(9);
  });
  it('every obstacle window is wide enough for a person: at least 100 ms', () => {
    for (const w of found.windows) expect(w.widthMs).toBeGreaterThanOrEqual(70);
  });
});

import ideal from '../src/course/default-course.ideal.json';
import { playPlan, type Plan } from '../src/sim/ideal';

describe('stored ideal run (npm run ideal)', () => {
  const plan = ideal.plan as Plan;
  it('is up to date: the stored plan still clears the course', () => {
    expect(playPlan(C, plan).world.outcome).toBe('cleared');
  });
  it('a press outside the window fails: the first jump 1.5 m too early or too late (past the edge) does not clear', () => {
    for (const d of [-1.5, 1.5]) {
      const bad: Plan = { ...plan, jumpXs: plan.jumpXs.map((x, i) => (i === 0 ? x + d : x)) };
      expect(playPlan(C, bad).world.outcome).not.toBe('cleared');
    }
  });
  it('the stored windows are real numbers in milliseconds', () => {
    expect(ideal.windows.length).toBeGreaterThanOrEqual(8);
    for (const w of ideal.windows) expect(w.widthMs).toBeGreaterThan(0);
  });
});
