// Seeding the ideal-run search with human lines (CC-176).
// The stored best line is a search result, not a limit: a person's verified run can be faster. This file turns the keys of such a run into a Plan
// (where the jumps, vaults and climbs were pressed, how long each bar was held), polishes it a little, and keeps whichever is faster: the seed or the stored plan.
// Pure TypeScript and deterministic; the simulator is the judge, so a seed that does not clear is simply not used.
import type { CourseData } from '../course/course';
import { playPlan, type Plan } from './ideal';
import { inputOfMask, type InputLog } from './replay';
import { newWorld, stepWorld } from './world';

const r3 = (x: number): number => Math.round(x * 1000) / 1000;
const down3 = (x: number): number => Math.floor(x * 1000 + 1e-9) / 1000; // a press is "at the first moment at or past x": rounding up would press a tick late

// The Plan a key log amounts to. The log is played on the simulator and each press is read where it happened.
export function planFromLog(course: CourseData, log: InputLog, base?: Plan): Plan {
  const plan: Plan = { jumpXs: [], releaseAfter: base?.releaseAfter ?? 60, bouncePress: base?.bouncePress ?? 8 };
  let w = newWorld(course, course.startX);
  let prevJump = false, prevVault = false, prevHands = false;
  let handX: number | null = null, handTick = -1e9;
  let hangStart: number | null = null, swingStart: number | null = null, bounceStart: number | null = null;
  const hangs: number[] = [];
  let prevMode = w.mode;
  for (const [m, count] of log) {
    const input = inputOfMask(m);
    for (let k = 0; k < count && w.outcome === 'running'; k++) {
      const grounded = w.runner.grounded && w.mode === 'run';
      const hands = !!(input.handL && input.handR);
      if (input.jump && !prevJump && grounded) plan.jumpXs.push(down3(w.runner.x));
      if (input.vault && !prevVault && grounded) (plan.vaultXs ??= []).push(down3(w.runner.x));
      if (hands && !prevHands && grounded) { handX = down3(w.runner.x); handTick = w.runner.tick; }
      if (w.mode === 'hang' && hangStart === null) hangStart = w.runner.tick;
      if (w.mode === 'swing' && swingStart === null) swingStart = w.runner.tick;
      if (w.mode === 'bounce' && bounceStart === null) bounceStart = w.runner.tick;
      if (input.jump && w.mode === 'swing' && swingStart !== null) plan.releaseAfter = w.runner.tick - swingStart;
      if (input.jump && w.mode === 'bounce' && bounceStart !== null && !prevJump) plan.bouncePress = w.runner.tick - bounceStart;
      prevJump = !!input.jump; prevVault = !!input.vault; prevHands = hands;
      w = stepWorld(w, input, course);
      if (prevMode !== 'climb' && w.mode === 'climb' && handX !== null && w.runner.tick - handTick < 120) { (plan.climbXs ??= []).push(handX); handX = null; }
      if (prevMode === 'hang' && w.mode !== 'hang' && hangStart !== null) { hangs.push(Math.max(0, w.runner.tick - hangStart - 1)); hangStart = null; }
      if (w.mode !== 'swing') swingStart = null;
      if (w.mode !== 'bounce') bounceStart = null;
      prevMode = w.mode;
    }
  }
  if (hangs.length) { plan.hands = true; plan.hangTicks = hangs; }
  // a catch of fewer bars than there are: the hand was kept off in the air after the last one (a skip)
  const nBars = course.holds?.length ?? 0;
  if (hangs.length && hangs.length < nBars) plan.airHands = hangs.map(() => false);
  return plan;
}

export interface Polished { plan: Plan; ticks: number }
const ticksOf = (course: CourseData, plan: Plan, cap: number): number | null => {
  const r = playPlan(course, plan, cap);
  return r.world.outcome === 'cleared' ? r.world.runner.tick : null;
};

// Small steps on each number of the plan, keeping a change only when the run still clears and gets faster. A few passes, then the finer step.
export function polish(course: CourseData, seed: Plan, opts: { passes?: number; cap?: number } = {}): Polished | null {
  const cap = opts.cap ?? 120 * 80;
  let best = ticksOf(course, seed, cap);
  if (best === null) return null;
  let plan: Plan = JSON.parse(JSON.stringify(seed));
  const fields: { get: (p: Plan) => number[] | undefined; key: 'jumpXs' | 'vaultXs' | 'climbXs' | 'hangTicks'; steps: number[] }[] = [
    { get: (p) => p.jumpXs, key: 'jumpXs', steps: [0.1, 0.02] },
    { get: (p) => p.vaultXs, key: 'vaultXs', steps: [0.1, 0.02] },
    { get: (p) => p.climbXs, key: 'climbXs', steps: [0.1, 0.02] },
    { get: (p) => p.hangTicks, key: 'hangTicks', steps: [12, 3, 1] },
  ];
  for (let pass = 0; pass < (opts.passes ?? 2); pass++) {
    let moved = false;
    for (const f of fields) {
      const arr = f.get(plan);
      if (!arr) continue;
      for (let i = 0; i < arr.length; i++) for (const step of f.steps) for (const dir of [-1, 1]) {
        for (let n = 0; n < 6; n++) { // keep walking the same way while it helps
          const cand: Plan = { ...plan, [f.key]: arr.map((v, j) => (j === i ? r3(v + dir * step) : v)) };
          const t = ticksOf(course, cand, Math.min(cap, best + 240));
          if (t === null || t >= best) break;
          best = t; plan = cand; arr[i] = (cand[f.key] as number[])[i]; moved = true;
        }
      }
    }
    if (!moved) break;
  }
  return { plan, ticks: best };
}

export interface SeededResult { plan: Plan; ticks: number; from: 'search' | 'seed'; searchTicks: number | null; seedTicks: (number | null)[] }

// Keep the faster of the searched plan and every seed. `stored` is the search result (null when it did not clear).
// A seed that beats the search is a finding, not an error: it is reported through `from: 'seed'`.
export function chooseWithSeeds(course: CourseData, stored: Plan | null, seeds: InputLog[], opts: { polish?: boolean } = {}): SeededResult | null {
  const searchTicks = stored ? ticksOf(course, stored, 120 * 120) : null;
  let best: { plan: Plan; ticks: number; from: 'search' | 'seed' } | null = stored && searchTicks !== null ? { plan: stored, ticks: searchTicks, from: 'search' } : null;
  const seedTicks: (number | null)[] = [];
  for (const log of seeds) {
    const raw = planFromLog(course, log, stored ?? undefined);
    const got = opts.polish === false ? ((t) => (t === null ? null : { plan: raw, ticks: t }))(ticksOf(course, raw, 120 * 120)) : polish(course, raw);
    seedTicks.push(got ? got.ticks : null);
    if (got && (!best || got.ticks < best.ticks)) best = { plan: got.plan, ticks: got.ticks, from: 'seed' };
  }
  return best ? { ...best, searchTicks, seedTicks } : null;
}
