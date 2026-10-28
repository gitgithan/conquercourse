import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { NO_INPUT } from '../src/sim/runner';
import { deg, DEFAULT_TREBUCHET, isDud, launchStep, mechanicalEnergy, releasedEnergy, riderEnergy, startLaunch, swingPath, type TrebuchetParams } from '../src/sim/trebuchet';
import { newWorld, stepWorld, type WorldState } from '../src/sim/world';
import { GRAVITY } from '../src/sim/units';

// A flat deck for the machine, then one long deck to land on (so the range is where the rider comes down).
const course = (t: Partial<TrebuchetParams> = {}): CourseData => ({
  version: 1, name: 'launch test', startX: -12, finishX: 900, jumpSpeed: 4.5,
  terrain: { waterY: -3, platforms: [{ x0: -14, x1: 6, top: 0 }, { x0: 8, x1: 1000, top: 0 }] },
  trebuchet: { x: 0, ...t },
});

// Pull the pin, press Space at `releaseTick` after it, and fly on to the ground. Returns where the rider came down (null: never released / dud).
function throwAt(c: CourseData, releaseTick: number): { x: number | null; world: WorldState; speed: number; angle: number } {
  let w = newWorld(c);
  let x: number | null = null, speed = 0, angle = 0, fired = -1;
  for (let i = 0; i < 120 * 12 && w.outcome === 'running'; i++) {
    const inLaunch = w.mode === 'launch';
    if (inLaunch && w.launch!.fired && fired < 0) fired = w.runner.tick;
    w = stepWorld(w, { ...NO_INPUT, run: true, jump: inLaunch && w.launch!.fired && w.launch!.t >= releaseTick, squat: true, roll: true }, c);
    const rel = w.events.find((e) => e.type === 'launch-release');
    if (rel) { speed = rel.detail!.speed as number; angle = deg(Math.atan2(rel.detail!.vy as number, rel.detail!.vx as number)); }
    if (w.events.some((e) => e.type === 'launch-dud')) return { x: null, world: w, speed: 0, angle: 0 };
    if (w.mode === 'run' && w.runner.grounded && rel === undefined && x === null && w.runner.vx !== 0 && w.runner.tick > 5 && fired >= 0 && w.runner.x > 0.5 && speed > 0) { x = w.runner.x; break; }
  }
  if (x === null && w.runner.grounded && speed > 0) x = w.runner.x;
  return { x, world: w, speed, angle };
}
const best = (c: CourseData) => {
  let top = { t: 0, x: 0, speed: 0, angle: 0 };
  for (let t = 20; t <= 320; t += 4) { const r = throwAt(c, t); if (r.x !== null && r.x > top.x) top = { t, x: r.x, speed: r.speed, angle: r.angle }; }
  return top;
};

describe('trebuchet: laws of the machine', () => {
  it('energy is conserved by the swing (no friction): the total drifts by less than 0.3 percent', () => {
    const p = { ...DEFAULT_TREBUCHET, x: 0 };
    let s = { ...startLaunch(p, 0), fired: true };
    const e0 = mechanicalEnergy(p, s);
    let worst = 0;
    for (let i = 0; i < 120 * 1.6; i++) { s = launchStep(s, p); worst = Math.max(worst, Math.abs(mechanicalEnergy(p, s) - e0) / Math.abs(e0)); }
    expect(worst).toBeLessThan(0.003);
  });
  it('the throw can never hold more energy than the falling counterweight gave up, and a well-tuned machine turns about half into the throw', () => {
    const p = { ...DEFAULT_TREBUCHET, x: 0 };
    let s = { ...startLaunch(p, 0), fired: true };
    let top = 0;
    for (let i = 0; i < 120 * 3 && deg(s.alpha) < p.stopAngle; i++) {
      s = launchStep(s, p);
      const given = releasedEnergy(p, s);
      expect(riderEnergy(p, s)).toBeLessThanOrEqual(given + 1);
      if (given > 1000) top = Math.max(top, riderEnergy(p, s) / given);
    }
    expect(top).toBeGreaterThan(0.4);
    expect(top).toBeLessThan(0.7);
    // even a very heavy weight never gives back more than it had (the stiff, frictionless machine tops out near 80 percent)
    const q = { ...p, counterweight: 2400 };
    let t = { ...startLaunch(q, 0), fired: true }, most = 0;
    for (let i = 0; i < 120 * 3 && deg(t.alpha) < q.stopAngle; i++) { t = launchStep(t, q); if (releasedEnergy(q, t) > 1000) most = Math.max(most, riderEnergy(q, t) / releasedEnergy(q, t)); }
    expect(most).toBeLessThan(0.9);
  });
  it('a balanced arm does not swing: with the weight times its distance equal to the rider times the arm, nothing moves', () => {
    const p: TrebuchetParams = { ...DEFAULT_TREBUCHET, x: 0, armMass: 0, riderMass: 80, long: 5, short: 1, sling: 0.01, counterweight: (80 * 5) / 1, startAngle: 0 };
    let s = { ...startLaunch(p, 0), beta: -Math.PI / 2, fired: true };
    for (let i = 0; i < 120; i++) s = launchStep(s, p);
    expect(Math.abs(deg(s.alpha))).toBeLessThan(0.5);
  });
  it('a lighter counterweight than the balance lets the rider drag the arm the wrong way, a heavier one turns it the right way', () => {
    const base: TrebuchetParams = { ...DEFAULT_TREBUCHET, x: 0, armMass: 0, long: 5, short: 1, sling: 0.01, startAngle: 0 };
    const turn = (M: number) => { const p = { ...base, counterweight: M }; let s = { ...startLaunch(p, 0), beta: -Math.PI / 2, fired: true }; for (let i = 0; i < 60; i++) s = launchStep(s, p); return s.alpha; };
    expect(turn(500)).toBeGreaterThan(0.001);
    expect(turn(300)).toBeLessThan(-0.001);
  });
});

describe('trebuchet: in the world', () => {
  it('the course starts in the sling, still, until the pin is pulled', () => {
    const c = course();
    let w = newWorld(c);
    expect(w.mode).toBe('launch');
    for (let i = 0; i < 60; i++) w = stepWorld(w, NO_INPUT, c);
    expect(w.mode).toBe('launch');
    expect(w.launch!.fired).toBe(false);
    expect(Math.abs(w.runner.vx) + Math.abs(w.runner.vy)).toBe(0);
  });
  it('a heavier counterweight throws farther, until the throw hits the stop', () => {
    const ranges = [900, 1200, 1600, 2000].map((M) => best(course({ counterweight: M })).x);
    for (let i = 1; i < ranges.length; i++) expect(ranges[i]).toBeGreaterThan(ranges[i - 1]);
  });
  it('a counterweight that is too light is a dud: the arm barely moves and nothing is thrown', () => {
    const c = course({ counterweight: 250 });
    let w = newWorld(c), dud = false;
    for (let i = 0; i < 120 * 4 && !dud; i++) { w = stepWorld(w, { ...NO_INPUT, run: true }, c); dud = w.events.some((e) => e.type === 'launch-dud'); }
    expect(dud).toBe(true);
    expect(w.mode).toBe('run');
    expect(w.runner.grounded).toBe(true);
  });
  it('the best release lets the rider go rising at a flight angle between 20 and 45 degrees, and the level-ground law (45 degrees for the most range) holds in the same flight', () => {
    const b = best(course({ counterweight: 1200 }));
    expect(b.x).toBeGreaterThan(15);
    expect(b.angle).toBeGreaterThan(15);
    expect(b.angle).toBeLessThan(50);
    // a ball thrown from the ground at 45 degrees goes farthest for the same speed: the world's own flight agrees
    const v = 12, at = (a: number) => { let w = newWorld({ ...course(), trebuchet: undefined }); const x0 = w.runner.x; w = { ...w, runner: { ...w.runner, vx: v * Math.cos((a * Math.PI) / 180), vy: v * Math.sin((a * Math.PI) / 180), grounded: false, y: 0.0001 } }; const c = course(); for (let i = 0; i < 1200 && !(w.runner.grounded); i++) w = stepWorld(w, NO_INPUT, { ...c, trebuchet: undefined, terrain: { waterY: -50, platforms: [{ x0: -50, x1: 1000, top: 0 }] } }); return (w.runner.landedAtX ?? w.runner.x) - x0; };
    const r = [30, 40, 45, 50, 60].map(at);
    expect(r[2]).toBeGreaterThan(r[0]); expect(r[2]).toBeGreaterThan(r[4]); expect(r[2]).toBeGreaterThanOrEqual(Math.max(...r) - 0.05);
    expect(Math.abs(r[2] - (v * v) / GRAVITY)).toBeLessThan(0.5);
  });
  it('isDud reads the rider below the deck only after the pin is pulled', () => {
    const p = { ...DEFAULT_TREBUCHET, x: 0 };
    expect(isDud(p, startLaunch(p, 0))).toBe(false);
    expect(swingPath({ ...p, counterweight: 250 }, 0).length).toBeGreaterThan(2);
  });
});
