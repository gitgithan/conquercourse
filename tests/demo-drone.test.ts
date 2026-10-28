import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { NO_INPUT } from '../src/sim/runner';
import { inputFor, playPlan, searchIdealRun } from '../src/sim/ideal';
import { newWorld, stepWorld, type WorldState } from '../src/sim/world';
import { predictDrone } from '../src/sim/predict';

const course = (): CourseData => JSON.parse(readFileSync('public/assets/demo/drone.course.json', 'utf8')) as CourseData;
const run = (c: CourseData, inputs: (w: WorldState) => ReturnType<typeof Object>, ticks = 120 * 40): WorldState => {
  let w = newWorld(c);
  for (let i = 0; i < ticks && w.outcome === 'running'; i++) w = stepWorld(w, inputs(w) as never, c);
  return w;
};

describe('the drone ferry course', () => {
  it('has a gap no run-up can jump and carries a stored line that clears it', () => {
    const c = course();
    expect(c.plan).toBeTruthy();
    const edge = c.terrain.platforms[0].x1, far = c.terrain.platforms[1].x0;
    expect(far - edge).toBe(40);
    expect(playPlan(c, c.plan!, 120 * 60).world.outcome).toBe('cleared');
  });
  it('without the drone the run ends in the water', () => {
    const w = run(course(), () => ({ ...NO_INPUT, run: true }));
    expect(w.outcome).toBe('splash');
  });
  it('holding E on the pad boards the drone, which lifts off the deck', () => {
    const c = course();
    let w = newWorld(c);
    const events: string[] = [];
    for (let i = 0; i < 120 * 4; i++) {
      const onPad = w.runner.x >= c.drone!.x0 && w.mode === 'run';
      w = stepWorld(w, { ...NO_INPUT, run: !onPad, handL: onPad || w.mode === 'drone', handR: onPad || w.mode === 'drone' }, c);
      events.push(...w.events.map((e) => e.type));
    }
    expect(events).toContain('drone-board');
    expect(w.mode).toBe('drone');
    expect(w.runner.y).toBeGreaterThan(0.5); // the feet are off the deck
  });
  it('a battery too small runs flat over the gap and the run ends in the water', () => {
    const c = { ...course(), drone: { ...course().drone!, battery: 15 } };
    const res = searchIdealRun(c);
    expect(res.cleared).toBe(false);
    const r = playPlan(c, course().plan!, 120 * 60);
    expect(r.events.map((e) => e.type)).toContain('drone-empty');
    expect(r.world.outcome).toBe('splash');
  });
  it('a rider too heavy to lift does not rise from the pad', () => {
    const c = { ...course(), drone: { ...course().drone!, payload: 300 } };
    let w = newWorld(c), top = -Infinity;
    for (let i = 0; i < 120 * 6; i++) {
      const onPad = w.mode === 'run' && w.runner.x >= c.drone!.x0 && w.runner.x <= c.drone!.x1;
      w = stepWorld(w, { ...NO_INPUT, run: !onPad && w.mode === 'run', handL: onPad || w.mode === 'drone', handR: onPad || w.mode === 'drone', up: true }, c);
      if (w.mode === 'drone') top = Math.max(top, w.runner.y);
    }
    expect(top).toBeLessThan(0.2);
  });
  it('a hard touchdown (leaning, or too fast) ends the run as a crash', () => {
    const c = course();
    const plan = { ...c.plan!, droneBrakeX: 1e9, droneDescendX: 30 }; // never brakes, comes down early over the water side... then arrives fast
    const r = playPlan(c, { ...plan, droneDescendX: 52 }, 120 * 60);
    expect(['hurt', 'splash']).toContain(r.world.outcome);
    expect(r.world.outcome).not.toBe('cleared');
  });
  it('letting go over the far deck is a drop from the height the drone had', () => {
    const c = course(), plan = c.plan!;
    let w = newWorld(c), st: any = { next: 0, caught: null, bedAt: null, hangAt: null, hangs: 0, vnext: 0, fnext: 0, airSince: null };
    const events: string[] = [];
    let released = false;
    for (let i = 0; i < 120 * 40 && w.outcome === 'running'; i++) {
      let input = inputFor(plan, w, st, c);
      if (w.mode === 'drone' && w.runner.x >= 52 && w.runner.y > 1.5) { input = { ...input, handL: false, handR: false }; released = true; }
      w = stepWorld(w, input, c);
      events.push(...w.events.map((e) => e.type));
    }
    expect(released).toBe(true);
    expect(events).toContain('drone-drop');
    expect(events).not.toContain('splash');
  });
  it('flying into the side of the far deck is a crash, not a free climb onto it', () => {
    const c = course();
    const r = playPlan(c, { ...c.plan!, droneBrakeX: 44, droneDescendX: 40 }, 120 * 60); // comes down early beside the deck's edge
    expect(r.world.outcome).toBe('hurt');
    expect(r.events.some((e) => e.type === 'drone-crash')).toBe(true);
  });
  it('the debug preview says where the drone would set you down', () => {
    const c = course();
    let w = newWorld(c);
    for (let i = 0; i < 120 * 3; i++) { const onPad = w.mode === 'run' && w.runner.x >= c.drone!.x0; w = stepWorld(w, { ...NO_INPUT, run: !onPad, handL: true, handR: true }, c); }
    expect(w.mode).toBe('drone');
    const pr = predictDrone(w, c);
    expect(pr.path.length).toBeGreaterThan(5);
    expect(pr.result).not.toBe('other-move');
  });
});
