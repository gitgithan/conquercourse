// The fork with one gate (CC-133, behind ?fork=1): two lanes over the same picture that meet again at the end.
//   Bench lane: run and jump or vault three benches.
//   Bulb lane: climb the lamp pole (hold E), then travel along a row of bars hung at the bulbs.
// The player picks a lane by the move they start with at the gate: run on toward the benches, or hold E at the pole. Nothing else decides it.
// The simulator is not changed for a lane (docs/fork.md): a lane is only the pieces of floor, the pole and the bars that belong to it, and the way taken is read from
// where the runner went (src/sim/branches.ts). This file builds such a course, proves each lane with the ideal-run search, and names the way a run took.
import type { CourseData } from '../course/course';
import type { Branch } from './branches';
import { fastestRoute, routeCourse, routeOfTrack } from './branches';
import { JUMP_COST } from './energy';
import { CLEARED, playPlan, searchIdealRun, type Plan } from './ideal';
import { trackFromPlan } from './replay';

export interface ForkSpec {
  startX: number;
  poleX: number; // the gate: the pole stands here, on the shared run-up
  barY: number; // the bars hang this high (above the hands' reach from a bench, so a jump cannot grab them)
  barXs: number[]; // the bar row, first bar next to the pole top
  benches: { x0: number; x1: number; top: number }[]; // the bench lane's benches, left to right
  joinX: number; // where the two lanes meet again
  finishX: number;
}
export const DEFAULT_FORK: ForkSpec = {
  startX: 2, poleX: 10, barY: 4.3, barXs: Array.from({ length: 8 }, (_, i) => 10.4 + 2 * i), joinX: 26, finishX: 40,
  benches: [{ x0: 14, x1: 15.6, top: 0.45 }, { x0: 18.5, x1: 20.1, top: 0.45 }, { x0: 23, x1: 24.6, top: 0.45 }],
};
/** The band that tells the lanes apart: the lowest height the runner reaches between the fork and the join (feet). Below it is the bench lane, at or above it the bulb lane. */
export const BULB_BAND_LO = 1.0;

/** The course for a spec: platforms 0 (run-up) and the last (the join and the finish) are shared; the floor pieces between belong to the bench lane. */
export function buildForkCourse(spec: ForkSpec = DEFAULT_FORK, name = 'Bench lane and bulb lane'): CourseData {
  const forkX = spec.poleX + 0.3;
  const platforms: { x0: number; x1: number; top: number }[] = [{ x0: -10, x1: forkX, top: 0 }];
  const own: number[] = [];
  let x = forkX;
  for (const b of spec.benches) {
    if (b.x0 > x) { own.push(platforms.length); platforms.push({ x0: x, x1: b.x0, top: 0 }); }
    own.push(platforms.length); platforms.push({ x0: b.x0, x1: b.x1, top: b.top });
    x = b.x1;
  }
  if (spec.joinX > x) { own.push(platforms.length); platforms.push({ x0: x, x1: spec.joinX, top: 0 }); }
  platforms.push({ x0: spec.joinX, x1: spec.finishX + 30, top: 0 });
  const bars = spec.barXs.map((bx) => ({ x: bx, y: spec.barY }));
  const branch: Branch = {
    id: 'fork', name: 'The fork: benches or bulbs', forkX, joinX: spec.joinX,
    routes: [
      { id: 'bench', name: 'Bench lane: run and vault the benches', band: [-1e9, BULB_BAND_LO], own: { platforms: own }, icons: ['step', 'vault', 'step'] },
      { id: 'bulb', name: 'Bulb lane: climb the pole, swing the bars', band: [BULB_BAND_LO, 1e9], own: { holds: bars.map((_, i) => i), poles: [0] }, icons: ['climb', 'lache'] },
    ],
  };
  return {
    version: 1, name, startX: spec.startX, finishX: spec.finishX, jumpSpeed: 4.5, jumpKeep: 0.88,
    terrain: { waterY: -6, platforms },
    holds: bars,
    climbPoles: [{ x: spec.poleX, top: spec.barY, toHold: 0 }],
    zones: [{ id: 'fork', name: 'The fork: benches or bulbs', x0: spec.poleX - 4, x1: spec.joinX + 3 }],
    checkpoints: [{ id: 'fork', x: spec.startX }],
    branches: [branch],
    hazard: 'lava',
  } as unknown as CourseData;
}

/** A bulb-lane score: a clear is worth CLEARED minus its ticks (faster is better); a fall is worth how far it got. */
const scoreBulb = (course: CourseData, plan: Plan): number => {
  const r = playPlan(course, plan);
  return r.world.outcome === 'cleared' ? CLEARED - r.world.runner.tick : r.maxX;
};

/** The ideal line of the bulb lane on its own: hold E at the pole, then how long to hang on each bar. Greedy bar by bar, twice, coarse then fine. */
export function searchBulbLane(sub: CourseData): { plan: Plan; cleared: boolean; ticks: number; narrowestMs: number } | null {
  const pole = sub.climbPoles?.[0], holds = sub.holds ?? [];
  if (!pole || !holds.length) return null;
  const plan: Plan = { jumpXs: [], releaseAfter: 60, bouncePress: 8, climbXs: [pole.x - 0.4], hands: true, hangTicks: holds.map(() => 90) };
  const tryAll = (k: number, values: number[]) => {
    let best = -Infinity, at = plan.hangTicks![k];
    for (const t of values) {
      const s = scoreBulb(sub, { ...plan, hangTicks: plan.hangTicks!.map((v, i) => (i === k ? t : v)) });
      if (s > best) { best = s; at = t; }
    }
    plan.hangTicks![k] = at;
  };
  const range = (a: number, b: number, step: number) => Array.from({ length: Math.floor((b - a) / step) + 1 }, (_, i) => a + i * step);
  for (let k = 0; k < holds.length; k++) tryAll(k, range(0, 300, 6));
  for (let k = 0; k < holds.length; k++) tryAll(k, range(Math.max(0, plan.hangTicks![k] - 8), plan.hangTicks![k] + 8, 1));
  const r = playPlan(sub, plan);
  if (r.world.outcome !== 'cleared') return { plan, cleared: false, ticks: r.world.runner.tick, narrowestMs: 0 };
  // the room for error on each bar: how many ticks either side of the ideal still clear the whole lane
  let narrow = Infinity;
  for (let k = 0; k < holds.length; k++) {
    let lo = 0, hi = 0;
    while (lo < 60 && playPlan(sub, { ...plan, hangTicks: plan.hangTicks!.map((v, i) => (i === k ? v - lo - 1 : v)) }).world.outcome === 'cleared' && plan.hangTicks![k] - lo - 1 >= 0) lo++;
    while (hi < 60 && playPlan(sub, { ...plan, hangTicks: plan.hangTicks!.map((v, i) => (i === k ? v + hi + 1 : v)) }).world.outcome === 'cleared') hi++;
    narrow = Math.min(narrow, (lo + hi + 1) * (1000 / 120));
  }
  return { plan, cleared: true, ticks: r.world.runner.tick, narrowestMs: Math.round(narrow) };
}

export interface ProvedLane { id: string; cleared: boolean; ticks: number; effort: number; narrowestMs: number; readAs: string | null; plan: Plan }
/** Prove every lane of the first fork on its own, store each line on the course (as ways-plan does), and check each line on the WHOLE course reads as its own lane. */
export function proveFork(course: CourseData): ProvedLane[] {
  const b = course.branches![0], out: ProvedLane[] = [];
  for (const r of b.routes) {
    const sub = routeCourse(course, b.id, r.id);
    let plan: Plan, cleared: boolean, narrowestMs = 0;
    if (sub.climbPoles?.length) { const f = searchBulbLane(sub); plan = f!.plan; cleared = f!.cleared; narrowestMs = f!.narrowestMs; }
    else {
      const s = searchIdealRun(sub);
      plan = s.plan; cleared = s.cleared;
      const ws = s.windows.map((w) => w.widthMs).filter((m) => m > 0);
      narrowestMs = ws.length ? Math.round(Math.min(...ws)) : 0;
    }
    const run = playPlan(sub, plan);
    const trk = trackFromPlan(course, plan);
    const readAs = playPlan(course, plan).world.outcome === 'cleared' ? routeOfTrack(b, trk.xs, trk.ys)?.id ?? null : null;
    const effort = Math.round(((1 - run.world.energy) / JUMP_COST) * 10) / 10;
    out.push({ id: r.id, cleared, ticks: run.world.runner.tick, effort, narrowestMs, readAs, plan });
    if (cleared) { r.plan = plan; r.ticks = run.world.runner.tick; r.effort = effort; r.narrowestMs = narrowestMs; } else { delete r.plan; delete r.ticks; }
  }
  const fast = fastestRoute(b);
  if (fast) course.plan = fast.plan;
  return out;
}
