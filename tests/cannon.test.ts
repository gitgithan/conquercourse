import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { playPlan, searchIdealRun, type Plan } from '../src/sim/ideal';
import { predictShot } from '../src/sim/predict';
import { AIM_MAX, AIM_RATE, DEFAULT_CANNON, DEFAULT_RECOIL, energyWords, levelRange, shot, shotEnergy, effectiveMuzzle } from '../src/sim/recoil';
import { NO_INPUT } from '../src/sim/runner';
import { newWorld, recoilParams, stepWorld, type WorldState } from '../src/sim/world';

const demo = JSON.parse(readFileSync('public/assets/demo/cannon.course.json', 'utf8')) as CourseData;

// A long flat lane with a cannon pad: the textbook ground for the angle lesson.
const flat: CourseData = {
  version: 1, name: 'flat', startX: 1, finishX: 190, jumpSpeed: 4.5,
  terrain: { waterY: -5, platforms: [{ x0: -10, x1: 200, top: 0 }] },
  recoil: { x0: 0, x1: 3, ...DEFAULT_CANNON, charMass: 70, shots: 1 },
};
const loaded = (c: CourseData, x?: number): WorldState => {
  const r = c.recoil!, startsOnPad = c.startX >= r.x0 && c.startX <= r.x1;
  let w = newWorld(c);
  for (let i = 0; i < 1200 && (w.recoil?.armed ?? 0) <= 0; i++) w = stepWorld(w, { ...NO_INPUT, run: !startsOnPad }, c); // run onto the pad: it clips the launcher on
  expect(w.recoil?.armed).toBe(1);
  if (x !== undefined) for (let i = 0; i < 1200 && w.runner.x < x; i++) w = stepWorld(w, { ...NO_INPUT, run: true }, c);
  return w;
};
// Fire at the given aim, then fly with nothing pressed until the feet land; returns the landing x and the highest point.
const flight = (c: CourseData, aim: number) => {
  let w = loaded(c);
  const x0 = w.runner.x;
  w = stepWorld(w, { ...NO_INPUT, aim, fire: true }, c);
  let top = 0;
  for (let i = 0; i < 2000 && w.outcome === 'running'; i++) {
    w = stepWorld(w, { ...NO_INPUT, roll: !w.runner.grounded }, c);
    top = Math.max(top, w.runner.y);
    if (w.runner.grounded && i > 3) break;
  }
  return { range: w.runner.x - x0, top, w };
};

describe('the aimed cannon obeys the vector law', () => {
  it('momentum is conserved along and up, at any aim and any speed', () => {
    const p = recoilParams(demo);
    for (const a of [0.1, 0.4, 0.8, 1.2]) for (const [vx, vy] of [[0, 0], [7, 0], [9, 3]]) {
      const s = shot(p, vx, vy, true, a), M = p.charMass + p.ballMass;
      expect(p.charMass * (vx + s.dvx) + p.ballMass * s.ballVx).toBeCloseTo(M * vx, 8);
      expect(p.charMass * (vy + s.dvy) + p.ballMass * s.ballVy).toBeCloseTo(M * vy, 8);
    }
  });
  it('the runner gets the ball mass over the total mass times the muzzle speed, split by the angle', () => {
    const p = recoilParams(demo), s = shot(p, 0, 0, false, 0.5), v = (p.ballMass * p.muzzle) / (p.charMass + p.ballMass);
    expect(Math.hypot(s.dvx, s.dvy)).toBeCloseTo(v, 9);
    expect(s.dvy / s.dvx).toBeCloseTo(Math.tan(0.5), 9);
    expect(v).toBeGreaterThan(20); // tens of metres a second: more than twice a sprint
  });
  it('the tank must store the energy the shot makes, and a smaller tank limits the muzzle speed', () => {
    const p = recoilParams(demo), mu = (p.charMass * p.ballMass) / (p.charMass + p.ballMass);
    expect(shotEnergy(p)).toBeCloseTo(0.5 * mu * p.muzzle ** 2, 6);
    expect(shotEnergy(p)).toBeLessThanOrEqual(p.energy!); // the demo's tank is big enough for its own shot
    expect(effectiveMuzzle({ ...p, energy: shotEnergy(p) / 4 })).toBeCloseTo(p.muzzle / 2, 6);
    expect(energyWords(shotEnergy(p))).toMatch(/kJ.*car.*km\/h/);
  });
});

describe('aiming: Up and Down tilt the barrel while it is loaded', () => {
  it('Up raises it, Down lowers it, and it stops at the ends', () => {
    let w = loaded(demo);
    const a0 = w.recoil!.aim!;
    expect(a0).toBeCloseTo(DEFAULT_CANNON.angle, 9);
    for (let i = 0; i < 12; i++) w = stepWorld(w, { ...NO_INPUT, aimDown: true }, demo); // a tenth of a second
    expect(w.recoil!.aim!).toBeCloseTo(a0 - AIM_RATE * 0.1, 6);
    for (let i = 0; i < 1200; i++) w = stepWorld(w, { ...NO_INPUT, aimUp: true }, demo);
    expect(w.recoil!.aim!).toBeCloseTo(AIM_MAX, 9);
    for (let i = 0; i < 2400; i++) w = stepWorld(w, { ...NO_INPUT, aimDown: true }, demo);
    expect(w.recoil!.aim!).toBe(0);
  });
  it('the shot goes where the barrel points: the push angle is the aim', () => {
    let w = loaded(demo);
    for (let i = 0; i < 24; i++) w = stepWorld(w, { ...NO_INPUT, aimDown: true }, demo);
    const aim = w.recoil!.aim!;
    w = stepWorld(w, { ...NO_INPUT, fire: true }, demo);
    const e = w.events.find((q) => q.type === 'recoil')!;
    expect(Math.atan2(e.detail!.dvy as number, e.detail!.dvx as number)).toBeCloseTo(aim, 9);
  });
});

describe('the best angle on level ground is near 45 degrees', () => {
  const rows = Array.from({ length: 16 }, (_, i) => 5 + i * 5).map((deg) => ({ deg, ...flight(flat, (deg * Math.PI) / 180) }));
  it('range peaks within 4 degrees of 45', () => {
    const best = rows.reduce((a, b) => (b.range > a.range ? b : a));
    expect(Math.abs(best.deg - 45)).toBeLessThanOrEqual(4);
  });
  it('a steeper shot goes higher and shorter; a flatter one lower and shorter', () => {
    const at = (d: number) => rows.find((r) => r.deg === d)!;
    expect(at(70).top).toBeGreaterThan(at(45).top);
    expect(at(70).range).toBeLessThan(at(45).range);
    expect(at(20).top).toBeLessThan(at(45).top);
    expect(at(20).range).toBeLessThan(at(45).range);
  });
  it('the simulator agrees with the textbook range, within a metre', () => {
    const p = recoilParams(flat), s = shot(p, 0, 0, false, Math.PI / 4);
    expect(rows.find((r) => r.deg === 45)!.range).toBeCloseTo(levelRange(s.dvx, s.dvy), 0);
  });
});

describe('the dotted preview is the real flight', () => {
  it('the predicted landing is where the shot really lands (flat ground, the textbook range)', () => {
    let w = loaded(flat);
    w = stepWorld(w, { ...NO_INPUT, aim: 0.3 }, flat); // 17 degrees: a flight of about 50 m that a roll takes
    const aim = w.recoil!.aim!, pr = predictShot(w, flat);
    const s = shot(recoilParams(flat), 0, 0, false, aim);
    expect(pr.result).toBe('lands');
    expect(pr.landX! - w.runner.x).toBeCloseTo(levelRange(s.dvx, s.dvy), 0);
    expect(pr.path.length).toBeGreaterThan(100);
    expect(pr.path[0]).toEqual({ x: w.runner.x, y: w.runner.y });
  });
  it('on the demo it is the same path as firing for real and rolling in the air', () => {
    let w = loaded(demo, 11.05);
    w = stepWorld(w, { ...NO_INPUT, run: true, aim: 0.25 }, demo);
    const pr = predictShot(w, demo);
    let r = stepWorld(w, { ...NO_INPUT, fire: true }, demo);
    const real = [{ x: w.runner.x, y: w.runner.y }, { x: r.runner.x, y: r.runner.y }];
    let left = false;
    for (let i = 0; i < 900; i++) {
      r = stepWorld(r, { ...NO_INPUT, roll: !r.runner.grounded }, demo);
      real.push({ x: r.runner.x, y: r.runner.y });
      if (!r.runner.grounded) left = true;
      if (left && r.runner.grounded) break;
    }
    expect(pr.result).toBe('lands');
    expect(pr.path.length).toBe(real.length);
    expect(pr.path[pr.path.length - 1].x).toBeCloseTo(real[real.length - 1].x, 9);
    expect(pr.why).toMatch(/tap X/); // a 4 m drop onto the far deck is rolled out
  });
  it('the start aim of 40 degrees on the demo flies past the far deck, and the words say so', () => {
    let w = loaded(demo, 11.05);
    w = stepWorld(w, { ...NO_INPUT, run: true }, demo); // nobody touched the barrel
    const pr = predictShot(w, demo);
    expect(pr.result).toBe('splash');
    expect(pr.why).toMatch(/past the end of the ground/);
  });
});

describe('the cannon demo course', () => {
  it('is a gap no run-up can jump', () => {
    expect(searchIdealRun({ ...demo, recoil: undefined, plan: undefined }).cleared).toBe(false);
  });
  it('the stored plan aims, fires and rolls out of the landing, and clears', () => {
    const plan = demo.plan as Plan;
    expect(plan.aim).toBeGreaterThan(0.05);
    expect(plan.fireXs?.length).toBe(1);
    const r = playPlan(demo, plan);
    expect(r.world.outcome).toBe('cleared');
    const land = r.events.find((e) => e.type === 'land' && (e.detail?.impact as number) > 5)!;
    expect(land.detail!.rolled).toBe(true); // the roll matters: the fall would hurt on straight legs
    expect(((land.detail!.impact as number) ** 2) / (2 * 9.81)).toBeGreaterThan(2.4);
  });
  it('the start aim (40 degrees) is too steep: fired as it stands the run does not clear', () => {
    const plan = { ...(demo.plan as Plan), aim: undefined } as Plan;
    expect(playPlan(demo, plan).world.outcome).not.toBe('cleared');
  });
  it('a light ball is too little', () => {
    const weak: CourseData = { ...demo, recoil: { ...demo.recoil!, ballMass: 10 } };
    expect(playPlan(weak, demo.plan as Plan).world.outcome).not.toBe('cleared');
  });
  it('the first recoil demo still works', () => {
    const first = JSON.parse(readFileSync('public/assets/demo/recoil.course.json', 'utf8')) as CourseData;
    expect(playPlan(first, first.plan as Plan).world.outcome).toBe('cleared');
    expect(DEFAULT_RECOIL.kind).toBe('cannon');
  });
});
