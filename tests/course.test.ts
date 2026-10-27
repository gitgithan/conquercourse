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

import { searchIdealRun } from '../src/sim/ideal';

describe('the ideal run', () => {
  const found = searchIdealRun(C);
  it('exists: the simulator proves the course can be cleared', () => {
    console.log(JSON.stringify(found.windows.map((w) => ({ ...w, widthMs: Math.round(w.widthMs) })), null, 1), found.plan);
    expect(found.cleared).toBe(true);
  });
});
