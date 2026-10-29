import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { playPlan, searchIdealRun, type Plan } from '../src/sim/ideal';
import { releaseWindow } from '../src/sim/launch-window';
import { predictLaunch } from '../src/sim/predict';
import { NO_INPUT } from '../src/sim/runner';
import { newWorld, stepWorld } from '../src/sim/world';
import { adviseMachineFor, armAngleAt, armRatio, fixMachineFor, laneCourseWith, machineCandidates } from '../src/slice/fix-launch';
import { withTrebuchet, wrapFor } from '../src/slice/launch-lane';
import { proves } from '../src/slice/photo-proof';
import { diffProposal, enabledCount, fromAdvice, machineItems, resultOf } from '../src/slice/preview';
import type { Mesh } from '../src/slice/slice';
import { newPiece, type Piece } from '../src/slice/world';

const load = (f: string) => JSON.parse(readFileSync(`public/assets/demo/${f}.course.json`, 'utf8')) as CourseData;
const lane = { angle: 0, offset: 0, level: 0 };

function box(w: number, h: number, d: number): Mesh {
  const [x0, x1, y0, y1, z0, z1] = [-w / 2, w / 2, 0, h, -d / 2, d / 2];
  const p = [x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1];
  const q = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2];
  return { positions: p, indices: q };
}
const world = (): Piece[] => [newPiece('Deck', box(16, 0.5, 1.8), { x: 0, z: 0 }), newPiece('Tower', box(11, 4, 1.8), { x: 24, z: 0 })];
// the editor's own lane (a first deck, a small gap, a landing deck 4 m up): known to clear with 1200 kg and not with 500 kg
const editorLane = (top: number): CourseData => ({
  version: 1, name: 'lane', startX: 0, finishX: 24, jumpSpeed: 4.5, uMap: [{ u0: 0, u1: 11, x0: 9 }],
  terrain: { waterY: -3, platforms: [{ x0: -10, x1: 6, top: 0 }, { x0: 9, x1: 20, top }, { x0: 23, x1: 31, top }] },
});
const courseFor = (m: Parameters<typeof withTrebuchet>[1]) => withTrebuchet(editorLane(4), m);

describe('the release window of the bar demos (measured from the simulator)', () => {
  const easy = load('launch-bar'), hard = load('launch-bar-hard');
  it('the easy demo can be won with a release anywhere in a quarter of a second or more', () => {
    const w = releaseWindow(easy)!;
    expect(w).not.toBeNull();
    expect(w.widthMs).toBeGreaterThanOrEqual(250);
    // the window really is made of winning releases: the two ends win and the tick beyond each end does not
    const plan = searchIdealRun({ ...easy, plan: undefined }).plan;
    const wins = (rel: number) => [0, ...Array.from({ length: 81 }, (_, i) => i * 6)].some((h) => playPlan(easy, { ...plan, launchRelease: rel, hangTicks: [h] }, 120 * 30).world.outcome === 'cleared');
    expect(wins(w.lo)).toBe(true);
    expect(wins(w.hi)).toBe(true);
    expect(wins(w.lo - 1)).toBe(false);
    expect(wins(w.hi + 1)).toBe(false);
  }, 240000);
  it('the hard demo keeps the narrower window (under a quarter of a second)', () => {
    expect(releaseWindow(hard)!.widthMs).toBeLessThan(250);
  }, 240000);
  it('both still need the bar: without it the throw falls short of the tower', () => {
    for (const c of [easy, hard]) expect(searchIdealRun({ ...c, holds: [], plan: undefined }).cleared).toBe(false);
  }, 240000);
});

describe('the LET GO NOW cue and the debug preview', () => {
  it('never says go while the rider would come back down on the machine\'s own deck, and mostly agrees with what really happens', () => {
    const c = load('launch'), plan = c.plan as Plan;
    let w = stepWorld(newWorld(c, c.startX), { ...NO_INPUT, run: true }, c);
    let agree = 0, total = 0;
    for (let t = 1; t < 400 && w.mode === 'launch'; t++) {
      const pl = predictLaunch(w, c);
      const cue = pl.result === 'lands' && /^You (reach|land)/.test(pl.why);
      if (cue) expect(pl.landX!).toBeGreaterThan(3.5); // the machine's deck ends at 3 m
      const real = playPlan(c, { ...plan, launchRelease: t, climbHands: true }).world.outcome === 'cleared'; // the cue's preview holds E at the wall, so the real run does too (CC-168)
      total++; if (cue === real) agree++;
      w = stepWorld(w, { ...NO_INPUT, run: true }, c);
    }
    expect(agree / total).toBeGreaterThanOrEqual(0.95);
  }, 120000);
  it('the landing it shows is where the rider really lands when let go with the same inputs', () => {
    const c = load('launch');
    const plan = c.plan as Plan;
    let w = stepWorld(newWorld(c, c.startX), { ...NO_INPUT, run: true }, c);
    for (let t = 1; t < plan.launchRelease! - 5 && w.mode === 'launch'; t++) w = stepWorld(w, { ...NO_INPUT, run: true }, c);
    const pl = predictLaunch(w, c);
    expect(pl.result).toBe('lands');
    let s = stepWorld(w, { ...NO_INPUT, run: true, jump: true }, c), left = false;
    for (let i = 0; i < 600; i++) {
      s = stepWorld(s, { ...NO_INPUT, run: true, squat: true, handR: true, roll: true }, c);
      if (!s.runner.grounded) left = true;
      if (left && s.runner.grounded) break;
    }
    expect(Math.abs(s.runner.x - pl.landX!)).toBeLessThan(0.05);
  }, 120000);
});

describe('Fix it and advice know the machine', () => {
  it('a gentler step is first: the candidates start with a tenth more or less', () => {
    const cs = machineCandidates({ counterweight: 1200 });
    expect(cs[0].machine.counterweight).toBe(1300);
    expect(cs.some((c) => c.machine.short !== undefined)).toBe(true);
    expect(cs.every((c) => c.machine.counterweight >= 300 && c.machine.counterweight <= 4000)).toBe(true);
    expect(cs[0].text).toBe('Use a 1300 kg counterweight (now 1200 kg).');
  });
  it('a counterweight too light to reach the tower is fixed by changing the counterweight', () => {
    expect(searchIdealRun(courseFor(1200)).cleared).toBe(true);
    expect(searchIdealRun(courseFor(500)).cleared).toBe(false);
    const r = fixMachineFor(courseFor, { counterweight: 500 });
    expect(r.ok).toBe(true);
    expect(r.machine.counterweight).toBeGreaterThan(500);
    expect(r.steps[0]).toMatch(/kg counterweight/);
    expect(searchIdealRun(courseFor(r.machine)).cleared).toBe(true);
  }, 240000);
  it('a machine that already works is left alone', () => {
    const r = fixMachineFor(courseFor, { counterweight: 1200 });
    expect(r.ok).toBe(true);
    expect(r.steps).toEqual([]);
  }, 120000);
  it('advice proves its suggestion with the machine on', () => {
    const a = adviseMachineFor(courseFor, { counterweight: 500 }, { budgetMs: 60000, max: 1 });
    expect(a.length).toBe(1);
    expect(a[0].machine!.counterweight).toBeGreaterThan(500);
    expect(a[0].verified).toBe(true);
    expect(searchIdealRun(courseFor(a[0].machine!)).cleared).toBe(true);
  }, 240000);
  it('the machine wrapper reaches the layout proofs (a 4 m landing is not rejected as too high to jump)', () => {
    const c = laneCourseWith(world(), lane, { counterweight: 1200 });
    expect(c?.trebuchet?.counterweight).toBe(1200);
    expect(proves(world(), lane, wrapFor({ counterweight: 1200 })) === proves(world(), lane, wrapFor({ counterweight: 1200 }))).toBe(true);
  }, 120000);
});

describe('the preview shows machine changes', () => {
  it('a machine change is an item with plain words, and switching it off leaves the machine alone', () => {
    const ps = world();
    const m = { counterweight: 500 };
    const next = { counterweight: 1300 };
    const items = machineItems(m, next);
    expect(items).toHaveLength(1);
    expect(items[0].words).toBe('Use a 1300 kg counterweight (now 500 kg).');
    const prop = diffProposal('fixit', 'Fix it', ps, lane, ps, lane, [], true, m, next);
    expect(enabledCount(prop)).toBe(1);
    expect(resultOf(ps, lane, prop, m).machine).toEqual(next);
    prop.items[0].on = false;
    expect(resultOf(ps, lane, prop, m).machine).toEqual(m);
    expect(ps.length).toBe(2); // the pieces are untouched
  });
  it('one piece of machine advice becomes a proposal with the new counterweight', () => {
    const ps = world();
    const prop = fromAdvice(ps, lane, { text: 'Use a 1300 kg counterweight (now 500 kg).', change: {}, verified: true, machine: { counterweight: 1300 } }, { counterweight: 500 });
    expect(prop.items.map((i) => i.kind)).toEqual(['machine']);
    expect(resultOf(ps, lane, prop, { counterweight: 500 }).machine?.counterweight).toBe(1300);
  });
  it('arm words and the pin words are plain', () => {
    const items = machineItems({ counterweight: 1200 }, { counterweight: 1200, short: 1.1, pin: 118 });
    expect(items.map((i) => i.words)).toEqual([
      `Change the arm to ${(5.5 / 1.1).toFixed(1)} to 1: the counterweight end 1.10 m from the pivot (now ${armRatio({ counterweight: 1200 }).toFixed(1)} to 1).`,
      'Add a pin at 118°: the machine lets the rider go by itself.',
    ]);
  });
});

describe('the pin lets the rider go at the arm angle (the release angle knob)', () => {
  it('a pin at the arm angle of the stored release clears the launch demo without a Space press', () => {
    const a = load('launch');
    const plan = a.plan as Plan;
    const angle = armAngleAt({ counterweight: 1200 }, 0, plan.launchRelease!);
    const pinned: CourseData = { ...a, trebuchet: { ...a.trebuchet!, pin: Math.floor(angle) } };
    const r = playPlan(pinned, { ...plan, launchRelease: 100000 }); // Space never comes: the pin does it
    expect(r.events.some((e) => e.type === 'launch-release')).toBe(true);
  });
});
