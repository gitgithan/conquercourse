import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { inputFor, playPlan, searchIdealRun, type Plan } from '../src/sim/ideal';
import { predictRelease } from '../src/sim/predict';
import { newWorld, stepWorld } from '../src/sim/world';

// A full pump on the first bar can fly over the second bar and reach the far deck (CC-67): a real shortcut, not a blocked one.
const demo = JSON.parse(readFileSync('public/assets/demo/lache.course.json', 'utf8')) as CourseData;
const farDeck = demo.terrain.platforms[demo.terrain.platforms.length - 1];
const catches = (p: Plan) => playPlan(demo, p).events.filter((e) => e.type === 'hang-catch').length;

describe('the skip over the second bar', () => {
  it('works: hold E, pump full, let go and keep the hand off: lands on the far deck without touching bar 2', () => {
    const r = playPlan(demo, demo.plan!);
    expect(r.world.outcome).toBe('cleared');
    expect(catches(demo.plan!)).toBe(1);
    expect(demo.plan!.airHands).toEqual([false]);
    expect(demo.plan!.hangTicks![0]).toBeGreaterThan(150); // a hard pump, about two seconds
    expect(r.world.runner.x).toBeGreaterThanOrEqual(farDeck.x0);
  });
  it('needs the pump: a short swing does not reach the far deck over the second bar', () => {
    const p: Plan = { ...demo.plan!, hangTicks: [60], airHands: [false] };
    expect(playPlan(demo, p).world.outcome).not.toBe('cleared');
  });
  it('the normal route still works: bar to bar, both bars caught, onto the far deck', () => {
    let found: Plan | null = null;
    for (let h1 = 0; h1 <= 180 && !found; h1 += 30) for (let h2 = 0; h2 <= 480 && !found; h2 += 30) {
      const p: Plan = { ...demo.plan!, hangTicks: [h1, h2], airHands: undefined };
      delete p.airHands;
      if (playPlan(demo, p).world.outcome === 'cleared' && catches(p) === 2) found = p;
    }
    expect(found).not.toBeNull();
  });
  it('the search compares the routes and follows the faster one, and both are reported', () => {
    const c: CourseData = JSON.parse(JSON.stringify(demo));
    delete c.plan; delete c.routes;
    const r = searchIdealRun(c, { routes: true });
    expect(r.cleared).toBe(true);
    expect(r.routes!.map((q) => q.name)).toEqual(['bar to bar', 'skip the second bar']);
    const fastest = [...r.routes!].sort((a, b) => a.ticks - b.ticks)[0];
    expect(fastest.chosen).toBe(true);
    expect(r.routes!.filter((q) => q.chosen).length).toBe(1);
    expect(fastest.name).toBe('skip the second bar');
  });
  it('the stored routes say the same, and the course where the skip is out of reach reports one route', () => {
    expect(demo.routes!.length).toBe(2);
    const wide = JSON.parse(readFileSync('public/assets/demo/lache-wide.course.json', 'utf8')) as CourseData;
    expect(wide.routes!.map((q) => q.name)).toEqual(['bar to bar']);
  });
  it('the hint says it as a fact: at the top of a full pump, letting go skips the second bar', () => {
    const plan = demo.plan!;
    let w = newWorld(demo, 0);
    const st = { next: 0, caught: null as number | null, bedAt: null as number | null, hangAt: null as number | null, hangs: 0, vnext: 0 };
    for (let i = 0; i < 120 * 40 && w.outcome === 'running'; i++) {
      if (w.mode === 'hang' && st.hangAt !== null && w.runner.tick - st.hangAt >= plan.hangTicks![0]) break; // the moment the plan lets go
      w = stepWorld(w, inputFor(plan, w, st, demo), demo);
    }
    expect(w.mode).toBe('hang');
    const pr = predictRelease(w, demo);
    expect(pr.why).toMatch(/second bar/);
    expect(pr.why).toMatch(/skipped/);
    expect(pr.why).not.toMatch(/good|bad|well done|perfect/i); // a fact, never a grade
  });
});
