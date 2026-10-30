import type { CourseData } from '../course/course';
import { NO_INPUT, type RunnerInput } from './runner';
import { newWorld, recoilParams, stepWorld, type GameEvent, type WorldState } from './world';
import { DT } from './units';
import { flewOff } from './cart';
import { rollNeeded } from './drop';
import { CLIMB_MIN_RISE, climbMaxRise } from './climb';
import { VAULT_MAX_RISE } from './vault';
import { groundAt, heightAt } from './terrain';
import { AIM_MAX, AIM_RATE, isAimable, type RecoilParams } from './recoil';
import { bandParams, reachableStretch, slackX, stretchAt } from './band';

// The ideal run: where to press Space at each obstacle, found by trying the simulator, and how wide the
// window of good presses is. It is the difficulty of each obstacle as a number.
export interface Plan {
  jumpXs: number[]; // press at the first moment the feet are on the ground at or past this x
  releaseAfter: number; // ticks after catching the rope
  bouncePress: number; // ticks after touching the trampoline bed
  vaultXs?: number[]; // press V at the first moment the feet are on the ground at or past this x
  climbXs?: number[]; // hold the hand key from this x on the ground: the hands meet a tall wall's edge and the body pulls up (src/sim/climb.ts)
  hands?: boolean; // hold the hand key while airborne (so a bar in reach is grabbed), until the last bar is behind
  climbHands?: boolean; // hold the hand key while airborne everywhere: a tall wall's edge is to be caught (src/sim/climb.ts)
  hangTicks?: number[]; // per bar: ticks to hang (pumping with the swing) before letting go
  airHands?: boolean[]; // per release: hold the hand key in the air afterwards (default true); false flies past the next bar (a skip)
  noGrab?: number[]; // bars (indexes into course.holds) the run flies past without holding (a shortcut that skips them)
  launchRelease?: number; // trebuchet: ticks after the pin is pulled at which Space lets the rider go
  aim?: number; // a big cannon: the barrel angle (rad) the line aims at before it fires
  fireXs?: number[]; // a launcher (recoil pad): press K at the first moment the runner is at or past this x
  fireAfterJump?: number; // or press K this many ticks after the take-off, so the shot adds to a jump
  droneBrakeX?: number; // a drone ferry: lean back (brake) from this x
  droneDescendX?: number; // and climb down from this x onto the far deck
  cartBrake?: [number, number][]; // a coaster: hold the brake between these x values (the first push is always given at the start)
  bandStretch?: number; // the elastic band: run away from the post until the band is stretched this many metres, then turn round and run toward it
}

export interface Window {
  obstacle: string;
  best: number; // ideal value (x in m, or ticks)
  lo: number;
  hi: number;
  widthMs: number; // how long the clearing window lasts, in milliseconds of game time
}

type PlanState = { next: number; caught: number | null; bedAt: number | null; hangAt?: number | null; hangs?: number; vnext?: number; cnext?: number; inClimb?: boolean; fnext?: number; airSince?: number | null; bandTurned?: boolean };
// The launcher (recoil): fire at a place along the run, or a number of ticks after the take-off (a shot in the air adds to a jump)
export function inputFor(plan: Plan, w: WorldState, state: PlanState, course?: CourseData): RunnerInput {
  const inp = inputForBase(plan, w, state, course);
  if (w.mode !== 'run') return inp;
  if (w.runner.grounded) state.airSince = null; else if (state.airSince == null) state.airSince = w.runner.tick;
  if (!w.recoil || w.recoil.armed <= 0) return inp;
  const aimed = plan.aim !== undefined ? { ...inp, aim: plan.aim } : inp; // a big cannon: tilt the barrel to the planned angle
  const byX = plan.fireXs && (state.fnext ?? 0) < plan.fireXs.length && w.runner.x >= plan.fireXs[state.fnext ?? 0];
  const byAir = plan.fireAfterJump !== undefined && state.airSince != null && w.runner.tick - state.airSince >= plan.fireAfterJump;
  if (!byX && !byAir) return aimed;
  state.fnext = (state.fnext ?? 0) + 1;
  return { ...aimed, fire: true };
}
function inputForBase(plan: Plan, w: WorldState, state: PlanState, course?: CourseData): RunnerInput {
  if (w.mode === 'cart') { // the cart: push at the start, brake where the plan says
    const x = w.runner.x;
    return { ...NO_INPUT, run: !w.cart?.started, squat: !!plan.cartBrake?.some(([a, b]) => x >= a && x <= b) };
  }
  if (w.mode === 'band' && course) { // the band: pull it to the planned stretch (running away from the post), then run toward the post and let it throw you
    if (!state.bandTurned && stretchAt(bandParams(course), w.runner.x) >= (plan.bandStretch ?? 8)) state.bandTurned = true;
    return state.bandTurned ? { ...NO_INPUT, run: true, squat: true } : { ...NO_INPUT, left: true };
  }
  if (w.mode === 'drone' && w.drone) { // the ferry: lean forward to speed up, lean back to slow down, then climb down onto the far deck
    const x = w.runner.x, braking = x >= (plan.droneBrakeX ?? 1e9);
    return { ...NO_INPUT, handL: true, handR: true, run: !braking, left: braking && w.drone.vx > 1, squat: x >= (plan.droneDescendX ?? 1e9) };
  }
  if (course?.drone && w.mode === 'run' && w.runner.grounded && w.runner.x >= course.drone.x0 && w.runner.x <= course.drone.x1) return { ...NO_INPUT, handL: true, handR: true }; // on the pad: hold E to board
  const base: RunnerInput = { ...NO_INPUT, run: true, squat: true, ...(course && rollNeeded(w, course) ? { roll: true } : {}) }; // a drop a squat cannot take cleanly: roll just before the ground
  if (w.mode === 'launch') return { ...NO_INPUT, run: true, squat: true, ...(w.launch?.fired && w.launch.t >= (plan.launchRelease ?? 120) ? { jump: true } : {}) }; // pull the pin, then let go at the planned moment
  if (w.mode === 'wall') return { ...NO_INPUT, run: true, handL: true, handR: true }; // the warped wall: the hands hold on near the top
  if (w.mode === 'climb') { // hanging from the edge: keep the hold key down through the pull-up
    if (!state.inClimb) { state.inClimb = true; state.cnext = (state.cnext ?? 0) + 1; }
    return { ...NO_INPUT, handL: true, handR: true, squat: true };
  }
  state.inClimb = false;
  if (w.mode === 'hang') {
    if (state.hangAt == null) state.hangAt = w.runner.tick;
    const idx = state.hangs ?? 0;
    if (w.runner.tick - state.hangAt >= (plan.hangTicks?.[idx] ?? 90)) { state.hangAt = null; state.hangs = idx + 1; return base; } // let go
    const forward = (w.hang?.omega ?? 0) >= 0; // pump the way the body is moving: more swing
    return { ...NO_INPUT, squat: true, handL: true, handR: true, run: forward, left: !forward };
  }
  state.hangAt = null;
  const barsAhead = !course?.holds?.length || course.holds.some((h) => h.x + 1.5 > w.runner.x); // past the last bar the hands stay off, so a fall beside a ledge is a fall, not a grab
  if (((plan.hands && barsAhead) || plan.climbHands) && w.mode === 'run' && !w.runner.grounded && plan.airHands?.[(state.hangs ?? 0) - 1] !== false && !skipsNext(plan, w, course)) return { ...base, handR: true };
  if (w.mode === 'swing') {
    if (state.caught === null) state.caught = w.runner.tick;
    return w.runner.tick - state.caught >= plan.releaseAfter ? { ...base, jump: true } : base;
  }
  state.caught = null;
  if (w.mode === 'bounce') {
    if (state.bedAt === null) state.bedAt = w.runner.tick;
    return w.runner.tick - state.bedAt >= plan.bouncePress ? { ...base, jump: true } : base;
  }
  state.bedAt = null;
  if (w.mode === 'run' && w.runner.grounded && plan.climbXs && (state.cnext ?? 0) < plan.climbXs.length && w.runner.x >= plan.climbXs[state.cnext ?? 0]) return { ...base, handL: true, handR: true };
  if (w.mode === 'run' && w.runner.grounded && plan.vaultXs && (state.vnext ?? 0) < plan.vaultXs.length && w.runner.x >= plan.vaultXs[state.vnext ?? 0]) {
    state.vnext = (state.vnext ?? 0) + 1;
    return { ...base, vault: true };
  }
  if (w.runner.grounded && state.next < plan.jumpXs.length && w.runner.x >= plan.jumpXs[state.next]) {
    state.next++;
    return { ...base, jump: true };
  }
  return base;
}

// the next bar ahead of the runner is one the plan flies past: do not hold the hand key for it
function skipsNext(plan: Plan, w: WorldState, course?: CourseData): boolean {
  if (!plan.noGrab?.length || !course?.holds) return false;
  let best = -1, bd = Infinity;
  course.holds.forEach((h, i) => { const d = h.x - w.runner.x; if (d > -1.5 && d < bd) { bd = d; best = i; } });
  return best >= 0 && plan.noGrab.includes(best);
}

export interface RunResult { world: WorldState; events: GameEvent[]; maxX: number; jumps: number }

// The work the searches have done so far, in simulated ticks. A budget counted in ticks gives the same answer on a slow machine as on a fast one
// (a budget counted in milliseconds does not): Fix it and the advice stop after so many ticks, not so many seconds.
export const meter = { ticks: 0 };
// A budget is written in work seconds: how long the work takes on the reference machine (about 330 000 simulated ticks a second).
// It is a count of ticks, so a slow machine takes longer for the same answer instead of giving up early.
export const TICKS_PER_WORK_SECOND = 330_000;
export const workSeconds = (s: number): number => Math.round(s * TICKS_PER_WORK_SECOND);

// "Does the ideal run clear this course?" asked again and again by Fix it and the advice (the same lane is proved once to check it, once to start a fix, once to confirm it).
// The answer is remembered; a repeat still adds the ticks the first proof cost, so a budget counts the same work whether or not the answer was remembered.
const proved = new Map<string, { cleared: boolean; ticks: number }>();
export function clearedCached(course: CourseData): boolean {
  const key = JSON.stringify(course);
  const hit = proved.get(key);
  if (hit) { meter.ticks += hit.ticks; return hit.cleared; }
  const m0 = meter.ticks;
  const cleared = searchIdealRun(course).cleared;
  proved.set(key, { cleared, ticks: meter.ticks - m0 });
  if (proved.size > 300) proved.delete(proved.keys().next().value!);
  return cleared;
}

export function playPlan(course: CourseData, plan: Plan, maxTicks = 120 * 80, trace?: (w: WorldState) => void): RunResult { // trace sees the world before the first tick and after every tick (the ghost keeps where the runner was)
  let w = newWorld(course);
  const st = { next: 0, caught: null as number | null, bedAt: null as number | null, hangAt: null as number | null, hangs: 0, vnext: 0, cnext: 0, inClimb: false, fnext: 0, airSince: null as number | null, bandTurned: false };
  const events: GameEvent[] = [];
  let maxX = 0;
  let still = 0;
  let spent = 0;
  trace?.(w);
  for (let i = 0; i < maxTicks && w.outcome === 'running'; i++) {
    spent++;
    w = stepWorld(w, inputFor(plan, w, st, course), course);
    trace?.(w);
    events.push(...w.events);
    if (!Number.isFinite(w.runner.x)) break; // a state that went to NaN has nowhere to go
    maxX = Math.max(maxX, w.runner.x);
    // a runner pressed against something it cannot pass will never get anywhere: stop after 1.5 s of standing still (it only costs time to go on)
    still = w.mode === 'run' && w.runner.grounded && Math.abs(w.runner.vx) < 0.01 ? still + 1 : 0;
    if (still > 180) break;
  }
  meter.ticks += spent;
  return { world: w, events, maxX, jumps: st.next };
}

// Take-off edges: the right end of every platform that is followed by a gap (water or a lower drop).
export function edges(course: CourseData): { x: number; name: string }[] {
  const ps = [...course.terrain.platforms].sort((a, b) => a.x0 - b.x0);
  const out: { x: number; name: string }[] = [];
  ps.forEach((p, i) => {
    const nxt = ps[i + 1];
    const planked = !!course.planks?.some((pk) => Math.abs(pk.x0 - p.x1) < 0.05 && pk.x1 <= nxt?.x0 + 0.05); // a plank is laid across this gap: nobody needs to jump it
    if (nxt && !planked && nxt.x0 - p.x1 > 0.01 && p.x1 >= course.startX && !p.bouncy) out.push({ x: p.x1, name: `edge at ${p.x1} m` }); // edges behind the start are not part of this run; a bed is left by its bounce, not by a jump
  });
  return out;
}

// Steps up that touch the ground before them and are too tall to walk up (0.3 m) but within a vault's or a climb's reach (the Warped Wall is another move).
export function risers(course: CourseData): { x: number; name: string; riser: true; rise: number }[] {
  const ps = [...course.terrain.platforms].sort((a, b) => a.x0 - b.x0);
  const out: { x: number; name: string; riser: true; rise: number }[] = [];
  ps.forEach((p, i) => {
    const nxt = ps[i + 1];
    if (!nxt || nxt.x0 - p.x1 > 0.02 || p.x1 < course.startX) return;
    const rise = nxt.top - p.top;
    if (rise > 0.3 && rise <= climbMaxRise(course.jumpSpeed) && !(course.wall && Math.abs(nxt.x0 - (course.wall.x0 + (course.wall.radius ?? course.wall.height ?? 4.3))) < 0.5)) out.push({ x: p.x1, name: `step at ${p.x1} m`, riser: true, rise });
  });
  return out;
}

// Time allowed for the run to reach x before the trial's own time starts (CC-164): the bar trials were cut at 25 s and the route trials at 40 s from the start of the run,
// so on a course with other obstacles before the bars (Training: the bars are at 28 s and the whole line takes 40 s) no trial ever reached them. A run that falls stops at once, so this costs nothing for failures.
const lead = (course: CourseData, x: number): number => Math.ceil(Math.max(0, x - course.startX) / 5 * 120);

const candidates = (from: number, to: number, step = 0.02) => {
  const out: number[] = [];
  for (let x = from; x <= to + 1e-9; x += step) out.push(Math.round(x * 1000) / 1000);
  return out;
}

// ---- The search, written as a generator ----
// It never plays the simulator itself: it hands over batches of plans to try and gets their scores back. A driver decides where the batches run:
// `driveSync` plays them one by one on this thread, `driveAsync` hands them to a pool of workers (src/sim/ideal-pool.ts). Same plans in the same
// order, so the answer is the same either way.
export interface Job { plan: Plan; maxTicks?: number }
export interface Batch { jobs: Job[]; stopOnClear?: boolean; label: string; step: number; of: number } // stopOnClear: the scores after the first clear are not wanted
export interface SearchResult { plan: Plan; windows: Window[]; cleared: boolean; routes?: Route[] }
type Gen<T> = Generator<Batch, T, number[]>;

export const CLEARED = 1e6;

// The windows measured in metres along the run (the take-off edges, vaults and steps), the ones a course can store next to its plan; the others are in ticks of one search.
export const xWindows = (ws: Window[]): Window[] => ws.filter((w) => /^(edge at|vault at|jump at)/.test(w.obstacle));
export const shiftWindow = (w: Window, dx: number): Window => ({ ...w, obstacle: w.obstacle.replace(/(-?\d+(?:\.\d+)?) m/, (_m, n: string) => `${Math.round((Number(n) + dx) * 100) / 100} m`), best: Math.round((w.best + dx) * 100) / 100, lo: Math.round((w.lo + dx) * 100) / 100, hi: Math.round((w.hi + dx) * 100) / 100 });
const scoreOf = (r: RunResult): number => (r.world.outcome === 'cleared' ? CLEARED : r.maxX);
export const evalJob = (course: CourseData, j: Job): number => scoreOf(playPlan(course, j.plan, j.maxTicks));

export function driveSync<T>(course: CourseData, g: Gen<T>): T {
  let r = g.next();
  while (!r.done) {
    const { jobs, stopOnClear } = r.value;
    const out: number[] = [];
    for (const j of jobs) { const s = evalJob(course, j); out.push(s); if (stopOnClear && s >= CLEARED) break; }
    r = g.next(out);
  }
  return r.value;
}

// `evaluate` plays a list of jobs somewhere else and gives back their scores in the same order. A batch that stops at the first clear is asked for in rounds.
export async function driveAsync<T>(g: Gen<T>, evaluate: (jobs: Job[]) => Promise<number[]>, round = 48, onBatch?: (b: Batch) => void): Promise<T> {
  let r = g.next();
  while (!r.done) {
    const b = r.value;
    onBatch?.(b);
    const out: number[] = [];
    if (!b.stopOnClear) out.push(...(await evaluate(b.jobs)));
    else for (let i = 0; i < b.jobs.length; i += round) {
      const got = await evaluate(b.jobs.slice(i, i + round));
      const k = got.findIndex((s) => s >= CLEARED);
      if (k >= 0) { out.push(...got.slice(0, k + 1)); break; }
      out.push(...got);
    }
    r = g.next(out);
  }
  return r.value;
}

// Greedy search: for each obstacle in order, try presses and keep the ones that reach farthest; the centre of the
// best group is the ideal press and the group's width is the clearing window.
// One way through a course with bars, with the time it takes (ticks at 120 Hz); `chosen` marks the faster one the plan follows.
export interface Route { name: string; ticks: number; bars: number; chosen: boolean }

export function searchIdealRun(course: CourseData, opts: { routes?: boolean } = {}): SearchResult {
  return driveSync(course, searchGen(course, opts));
}

// `alt` is the second-best branch (see the end of the search): for an edge index, which share (0 to 1) of the range of presses is taken, instead of the middle of the best ones.
export function* searchGen(course: CourseData, opts: { routes?: boolean; alt?: Record<number, number> } = {}): Gen<SearchResult> {
  if (course.track) return searchCartRun(course);
  if (course.drone) return searchDroneRun(course);
  const holds = course.holds ?? [];
  const plan: Plan = { jumpXs: [], releaseAfter: 60, bouncePress: 8, ...(holds.length ? { hands: true, hangTicks: holds.map(() => 90) } : {}) };
  const windows: Window[] = [];
  const ties: number[] = []; // the plain take-off edges that were planned: where the greedy choice may strand a later edge
  const tre = course.trebuchet;
  const onMachine = (x: number) => !!tre && course.terrain.platforms.some((p) => p.x0 <= tre.x && tre.x <= p.x1 && x >= p.x0 && x <= p.x1 + 0.01); // the machine's own deck: nobody runs off it, the rider is thrown
  const es: { x: number; name: string; riser?: boolean; rise?: number }[] = [...edges(course), ...risers(course)].filter((e) => !onMachine(e.x)).sort((a, b) => a.x - b.x);
  const hasRope = !!course.rope;
  const score = scoreOf; // the searches below that play their trials on this thread (the launcher, the band, climbing) use it
  if (tre) yield* searchLaunchGen(course, plan, windows);
  const handled = course.recoil ? searchRecoil(course, plan, windows, score) : null; // the first gap after the pad is planned together with the shot
  const bandEdge = course.band ? searchBand(course, plan, windows, score) : null; // the band and the jump at the edge after it are found together
  for (let k = 0; k < es.length; k++) {
    const e = es[k];
    if (handled !== null && Math.abs(e.x - handled) < 0.01) continue;
    if (bandEdge !== null && Math.abs(e.x - bandEdge) < 0.01) continue;
    const at = (jobs: Job[], stopOnClear = false): Batch => ({ jobs, stopOnClear, label: e.name, step: k, of: es.length });
    // bars within a swing of this edge: a joint search over the press and the hang times on the first two bars (a swing and the next catch depend on each other,
    // so tuning one at a time misses lines that clear), coarse first, then finer around the best few
    if (!e.riser && holds.some((h) => h.x > e.x - 1 && h.x < e.x + 9) && plan.hangTicks) {
      const nh = Math.min(2, plan.hangTicks.length);
      const found: { sc: number; plan: Plan }[] = [];
      const grid = function* (jxs: number[], hang: number[][]): Gen<boolean> {
        const plans: Plan[] = [];
        for (const jx of jxs) for (const hs of cross(hang)) plans.push({ ...plan, jumpXs: [...plan.jumpXs, jx], hangTicks: plan.hangTicks!.map((t, i) => (i < nh ? hs[i] : t)) });
        const sc: number[] = yield at(plans.map((pl) => ({ plan: pl, maxTicks: 120 * 25 + lead(course, e.x) })), true);
        sc.forEach((s, i) => found.push({ sc: s, plan: plans[i] }));
        return sc.length > 0 && sc[sc.length - 1] >= CLEARED;
      };
      const hangVals = (from: number, to: number, step: number) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);
      let done = yield* grid(candidates(e.x - 3, e.x, 0.3), Array.from({ length: nh }, () => hangVals(0, 480, 30)));
      // a narrow basin can fall between the coarse hang times: shift the grid by half a step before refining
      if (!done) done = yield* grid(candidates(e.x - 3, e.x, 0.3), Array.from({ length: nh }, () => hangVals(15, 465, 30)));
      if (!done) {
        const tops = [...found].sort((a, b) => b.sc - a.sc).slice(0, 8); // the coarse grid misses a narrow basin, so the finer search tries more of the best starts
        for (const t of tops) {
          const jx = t.plan.jumpXs[t.plan.jumpXs.length - 1];
          done = yield* grid(candidates(jx - 0.25, jx + 0.25, 0.05), t.plan.hangTicks!.slice(0, nh).map((h) => hangVals(Math.max(0, h - 24), h + 24, 6)));
          if (done) break;
        }
      }
      const win = found.reduce((a, b) => (b.sc > a.sc ? b : a));
      plan.jumpXs = win.plan.jumpXs; plan.hangTicks = win.plan.hangTicks;
      windows.push({ obstacle: `${e.name} (take-off)`, best: plan.jumpXs[plan.jumpXs.length - 1], lo: plan.jumpXs[plan.jumpXs.length - 1], hi: plan.jumpXs[plan.jumpXs.length - 1], widthMs: 0 });
      for (let pass = 0; pass < 2; pass++) for (let i = 0; i < plan.hangTicks!.length; i++) yield* tuneHangGen(plan, i, windows, pass === 1, at);
      continue;
    }
    if (e.riser) {
      // a step up too tall for a casual walk-up: try a vault and a jump at every press, keep the one that gets farthest (a vault wins a tie: it is faster)
      // a vault plants further back (a speed vault: 1 to 3 m before the face, plus the 0.2 s a press is held), so its presses are searched on a wider, coarser grid
      const trials: { x: number; vault: boolean; plan: Plan }[] = [];
      for (const vault of [false, true]) for (const x of vault ? candidates(e.x - 5, e.x - 0.05, 0.04) : candidates(e.x - 1.2, e.x - 0.05)) {
        trials.push({ x, vault, plan: vault ? { ...plan, vaultXs: [...(plan.vaultXs ?? []), x] } : { ...plan, jumpXs: [...plan.jumpXs, x] } });
      }
      const sc: number[] = yield at(trials.map((t) => ({ plan: t.plan })));
      const tries = trials.map((t, n) => ({ x: t.x, vault: t.vault, s: sc[n] }));
      const top = Math.max(...tries.map((t) => t.s));
      // a wall no vault or jump gets over: the hands meet its edge and the body pulls up (stand at the foot and hold, or jump and hold in the air)
      if (top < e.x + 1.0 && (e.rise ?? 9) > VAULT_MAX_RISE) { // above a vault's reach only
        const ct: { kind: 'stand' | 'jump'; x: number; s: number }[] = [];
        for (const x of candidates(e.x - 3, e.x - 0.05, 0.5)) ct.push({ kind: 'stand', x, s: score(playPlan(course, { ...plan, climbXs: [...(plan.climbXs ?? []), x] })) });
        if (!ct.some((t) => t.s >= 1e6)) for (const x of candidates(e.x - 4.5, e.x - 0.1, 0.2)) ct.push({ kind: 'jump', x, s: score(playPlan(course, { ...plan, jumpXs: [...plan.jumpXs, x], climbHands: true })) });
        const cbest = Math.max(...ct.map((t) => t.s));
        if (cbest > top + 0.3) {
          const good = ct.filter((t) => t.s >= cbest - (cbest >= 1e6 ? 1e-9 : 0.3));
          const kind = good.some((t) => t.kind === 'stand') ? 'stand' : 'jump'; // standing at the foot of the wall is simpler than a jump
          const xs = good.filter((t) => t.kind === kind).map((t) => t.x);
          const mid = xs[Math.floor(xs.length / 2)];
          if (kind === 'stand') plan.climbXs = [...(plan.climbXs ?? []), mid]; else { plan.jumpXs.push(mid); plan.climbHands = true; }
          windows.push({ obstacle: `climb at ${e.name}`, best: mid, lo: Math.min(...xs), hi: Math.max(...xs), widthMs: ((Math.max(...xs) - Math.min(...xs) + 0.1) / 7.4) * 1000 });
          continue;
        }
      }
      const good = tries.filter((t) => t.s >= top - (top >= CLEARED ? 1e-9 : 0.3)); // before the rest of the course is planned the score is how far the run gets: near ties count as ties
      // the centre of the window of presses that work (a vault wins a tie with a jump: it is faster), not its edge
      const kind = good.some((t) => t.vault);
      let mine = good.filter((t) => t.vault === kind).map((t) => t.x);
      // a vault pressed further out than its reach is held by the 0.2 s buffer until the step is in reach: for a plan, take the middle of the presses made at a real plant distance (up to 2.7 m before the face)
      if (kind) { const near = mine.filter((x) => x >= e.x - 2.7); if (near.length) mine = near; }
      const best = mine.length ? { x: mine[Math.floor(mine.length / 2)], vault: kind } : null;
      if (best) { if (best.vault) plan.vaultXs = [...(plan.vaultXs ?? []), best.x]; else plan.jumpXs.push(best.x); windows.push({ obstacle: `${best.vault ? 'vault' : 'jump'} at ${e.name}`, best: best.x, lo: Math.min(...mine), hi: Math.max(...mine), widthMs: ((Math.max(...mine) - Math.min(...mine) + 0.02) / 7.4) * 1000 }); }
      continue;
    }
    // a tall wall across the gap: the jump has to bring the hands to its edge, so the hold key is down in the air (src/sim/climb.ts)
    { const nextP = [...course.terrain.platforms].filter((q) => q.x0 > e.x - 0.01).sort((q, r) => q.x0 - r.x0)[0]; const here = groundAt(course.terrain, e.x - 0.05);
      if (nextP && Number.isFinite(here) && heightAt(nextP, nextP.x0) - here >= CLIMB_MIN_RISE) plan.climbHands = true; }
    // a bar within a swing of this edge: try presses on a coarser grid and, for each, several hang times on the first bar
    const holdEdge = holds.some((h) => h.x > e.x - 1 && h.x < e.x + 9);
    const cs = candidates(e.x - 3, e.x, holdEdge ? 0.1 : 0.02);
    // the runner jumps from a platform: the press must happen while still on it
    const ropeEdge = hasRope && e.x < course.rope!.anchorX && e.x > course.rope!.anchorX - 8;
    const releases = ropeEdge ? Array.from({ length: 21 }, (_, i) => i * 15) : [plan.releaseAfter];
    const hangOptions = holdEdge ? Array.from({ length: 13 }, (_, i) => i * 30) : [0];
    // at the rope's edge a press is good if SOME release timing then clears, so every press is tried with several
    const jobs: Job[] = [];
    for (const x of cs) for (const rel of releases) for (const hang of hangOptions) {
      const ht = holdEdge && plan.hangTicks ? plan.hangTicks.map((t, i) => (i === 0 ? hang : t)) : plan.hangTicks;
      jobs.push({ plan: { ...plan, jumpXs: [...plan.jumpXs, x], releaseAfter: rel, hangTicks: ht } });
    }
    const sc: number[] = yield at(jobs);
    const per = releases.length * hangOptions.length;
    const results = cs.map((x, n) => ({ x, s: Math.max(...sc.slice(n * per, (n + 1) * per)) }));
    // a press is good if the run then gets farther than any press can do by standing still at the edge
    const best = Math.max(...results.map((r) => r.s));
    const good = results.filter((r) => r.s >= best - 1e-9);
    // group = the longest run of consecutive candidates that all reach `best`
    const xs = good.map((g) => g.x);
    const lo = Math.min(...xs), hi = Math.max(...xs);
    ties.push(k);
    const share = opts.alt?.[k];
    const mid = share === undefined ? good[Math.floor(good.length / 2)].x : results[Math.round(share * (results.length - 1))].x; // the second-best branch spreads over every press
    plan.jumpXs.push(mid);
    const speed = 7.4;
    windows.push({ obstacle: e.name, best: mid, lo, hi, widthMs: ((hi - lo + 0.02) / speed) * 1000 });
    // tune the rope release and the bounce press once the runner can reach them
    if (ropeEdge) yield* tuneTicksGen(plan, 'releaseAfter', 0, 360, windows, 'rope release', at);
    if (holdEdge && plan.hangTicks) for (let pass = 0; pass < 2; pass++) for (let i = 0; i < plan.hangTicks.length; i++) yield* tuneHangGen(plan, i, windows, pass === 1, at);
    if (e.x > 117 && e.x < 119) {
      yield* tuneTicksGen(plan, 'bouncePress', 0, 40, windows, 'trampoline press', at, 1);
    }
  }
  // two ways through a pair of bars, asked for with `{ routes: true }`: it plays about 250 runs of its own on this thread
  if (opts.routes && holds.length >= 2 && plan.hangTicks) {
    const final = playPlan(course, plan);
    if (final.world.outcome === 'cleared') return { ...compareRoutes(course, plan, final, windows), windows };
  }
  const final: number[] = yield { jobs: [{ plan }], label: 'the whole course', step: es.length, of: es.length };
  const found = { plan, windows, cleared: final[0] >= CLEARED };
  // The greedy choice (the middle of the presses that reach farthest) can strand a later edge: a jump that lands well but leaves the next press no room.
  // When the run got to the last edges and still did not clear, try presses spread over the whole range at the last two take-off edges (a press that reaches less far now can leave the next edge room).
  const lastX = es.length ? es[es.length - 1].x : 0;
  if (found.cleared || opts.alt || ties.length === 0 || final[0] < lastX - 3) return found;
  for (const k of ties.slice(-2).reverse()) for (const share of [0, 0.25, 0.5, 0.75, 1]) {
    const r: SearchResult = yield* searchGen(course, { ...opts, alt: { [k]: share } });
    if (r.cleared) return r;
  }
  return found;
}

type AtFn = (jobs: Job[], stopOnClear?: boolean) => Batch;

// Two ways through a pair of bars (asked for with `{ routes: true }`: it adds about 250 runs, so the stored plans and the tests that need it use it, not every search):
// bar to bar (the plan the search found), or a full pump on the first bar and a flight over the second (a skip).
// Both are tried and the shorter total time is the line the plan follows; both are reported (the hint and the debug view say what is possible, as a fact).
function compareRoutes(course: CourseData, plan: Plan, base: RunResult, windows: Window[]): { plan: Plan; cleared: boolean; routes: Route[] } {
  const catches = (r: RunResult) => r.events.filter((e) => e.type === 'hang-catch').length;
  const baseBars = catches(base);
  type Opt = { plan: Plan; ticks: number; bars: number };
  // the jump that takes the runner to the first bar: the last press at or before it. It is the last press only when nothing is planned after the pair;
  // with a vault, rope or roll block behind it (Training, CC-164) the skip has to change this press and keep the later ones (CC-164: it used to change the last press, whatever it belonged to)
  const firstBarX = Math.min(...(course.holds ?? []).map((h) => h.x));
  let li = -1;
  plan.jumpXs.forEach((x, i) => { if (x <= firstBarX + 1e-9) li = i; });
  if (li < 0) li = plan.jumpXs.length - 1;
  const jx0 = plan.jumpXs[li];
  // bar to bar: the fastest way that catches both bars (the plan found may fly over the second one by luck, so the two ways are searched on their own)
  let viaBars: Opt | null = baseBars >= 2 ? { plan, ticks: base.world.runner.tick, bars: baseBars } : null;
  for (let h1 = 0; h1 <= 300; h1 += 30) for (let h2 = 0; h2 <= 480; h2 += 30) {
    const pl: Plan = { ...plan, hangTicks: [h1, h2, ...(plan.hangTicks?.slice(2) ?? [])] };
    delete pl.airHands;
    const r = playPlan(course, pl, 120 * 40 + lead(course, firstBarX));
    if (r.world.outcome === 'cleared' && catches(r) >= 2 && (!viaBars || r.world.runner.tick < viaBars.ticks)) viaBars = { plan: pl, ticks: r.world.runner.tick, bars: catches(r) };
  }
  // skip: a full pump on the first bar and the hand kept off in the air, so the second bar is flown over
  let skip: Opt | null = baseBars === 1 ? { plan, ticks: base.world.runner.tick, bars: 1 } : null;
  const skipPlan = (h: number, jx: number): Plan => ({ ...plan, jumpXs: plan.jumpXs.map((x, i) => (i === li ? jx : x)), hangTicks: [h], airHands: [false] });
  const tryHang = (jx: number, hs: number[]) => {
    for (const h of hs) {
      const r = playPlan(course, skipPlan(h, jx), 120 * 40 + lead(course, firstBarX));
      if (r.world.outcome === 'cleared' && catches(r) === 1 && (!skip || r.world.runner.tick < skip.ticks)) skip = { plan: skipPlan(h, jx), ticks: r.world.runner.tick, bars: 1 };
    }
  };
  const coarse = Array.from({ length: 91 }, (_, i) => i * 6);
  for (const jx of [jx0, ...[-0.3, -0.2, -0.1, 0.1, 0.2, 0.3].map((d) => Math.round((jx0 + d) * 100) / 100)]) { tryHang(jx, coarse); if (skip && skip.plan.airHands) break; }
  if (skip && skip.plan.airHands) { const b = skip as Opt; tryHang(b.plan.jumpXs[li], Array.from({ length: 13 }, (_, i) => Math.max(0, b.plan.hangTicks![0] - 6 + i))); }
  const opts = [viaBars && { name: 'bar to bar', ...viaBars }, skip && { name: 'skip the second bar', ...(skip as Opt) }].filter((o): o is Opt & { name: string } => !!o);
  if (!opts.length) return { plan, cleared: true, routes: [{ name: baseBars >= 2 ? 'bar to bar' : 'one bar', ticks: base.world.runner.tick, bars: baseBars, chosen: true }] };
  const fastest = opts.reduce((a, b) => (b.ticks < a.ticks ? b : a));
  const routes: Route[] = opts.map((o) => ({ name: o.name, ticks: o.ticks, bars: o.bars, chosen: o === fastest }));
  if (fastest.name.startsWith('skip')) windows.push({ obstacle: 'skip the second bar', best: fastest.plan.hangTicks![0], lo: fastest.plan.hangTicks![0], hi: fastest.plan.hangTicks![0], widthMs: DT * 1000 });
  return { plan: fastest.plan, cleared: true, routes };
}

// The trebuchet: when to let the rider go (ticks after the pin), found together with the hang time on the first bar when there is one.
function* searchLaunchGen(course: CourseData, plan: Plan, windows: Window[]): Gen<void> {
  const bars = (course.holds ?? []).length > 0;
  const mk = (rel: number, hang: number): Job => ({ plan: { ...plan, launchRelease: rel, ...(bars ? { hangTicks: plan.hangTicks!.map((t, i) => (i === 0 ? hang : t)) } : {}) }, maxTicks: 120 * 30 });
  const batch = (cells: { rel: number; hang: number }[]): Batch => ({ jobs: cells.map((c) => mk(c.rel, c.hang)), label: 'the trebuchet release', step: 0, of: 1 });
  const hangs = bars ? Array.from({ length: 17 }, (_, i) => i * 30) : [0];
  const cells: { rel: number; hang: number }[] = [];
  for (let rel = 20; rel <= 360; rel += 6) for (const h of hangs) cells.push({ rel, hang: h });
  const sc: number[] = yield batch(cells);
  const found: { sc: number; rel: number; hang: number }[] = cells.map((c, i) => ({ sc: sc[i], ...c }));
  const tops = [...found].sort((a, b) => b.sc - a.sc).slice(0, 8); // the coarse grid misses a narrow basin, so the finer search tries more of the best starts
  const fine: { rel: number; hang: number }[] = [];
  for (const t of tops) for (let rel = t.rel - 6; rel <= t.rel + 6; rel += 1) for (let h = Math.max(0, t.hang - 24); h <= t.hang + 24; h += bars ? 6 : 100) fine.push({ rel, hang: h });
  const sc2: number[] = yield batch(fine);
  fine.forEach((c, i) => found.push({ sc: sc2[i], ...c }));
  const best = Math.max(...found.map((f) => f.sc));
  const good = found.filter((f) => f.sc >= best - 1e-9);
  const centre = good.reduce((a, b) => (Math.abs(b.rel - median(good.map((g) => g.rel))) < Math.abs(a.rel - median(good.map((g) => g.rel))) ? b : a));
  plan.launchRelease = centre.rel;
  if (bars) plan.hangTicks = plan.hangTicks!.map((t, i) => (i === 0 ? centre.hang : t));
  const rels = good.filter((g) => g.hang === centre.hang).map((g) => g.rel);
  windows.push({ obstacle: 'trebuchet release', best: centre.rel, lo: Math.min(...rels), hi: Math.max(...rels), widthMs: (Math.max(...rels) - Math.min(...rels) + 1) * DT * 1000 });
}
// The launcher: when to fire (at a place on the ground, or some ticks after the take-off) and when to jump, found together because they depend on each other.
function searchRecoil(course: CourseData, plan: Plan, windows: Window[], score: (r: RunResult) => number): number | null {
  const rp = recoilParams(course);
  const e = edges(course).find((q) => q.x > rp.x1);
  if (!e) return null;
  if (isAimable(rp)) return searchCannon(course, plan, windows, score, rp, e.x, e.name);
  type T = { sc: number; jx: number; fire: { x?: number; air?: number } };
  const mk = (jx: number, fire: { x?: number; air?: number }): Plan => ({ ...plan, jumpXs: [...plan.jumpXs, jx], ...(fire.x !== undefined ? { fireXs: [fire.x] } : {}), ...(fire.air !== undefined ? { fireAfterJump: fire.air } : {}) });
  const trial = (jx: number, fire: { x?: number; air?: number }): T => ({ sc: score(playPlan(course, mk(jx, fire), 120 * 30)), jx, fire });
  const found: T[] = [];
  const jxs = candidates(e.x - 3, e.x, 0.1);
  for (const jx of jxs) for (let a = 0; a <= 60; a += 6) found.push(trial(jx, { air: a })); // a shot in the air, a moment after the take-off
  for (const jx of jxs) for (let d = 0; d <= 2; d += 0.25) found.push(trial(jx, { x: Math.max(rp.x0, jx - d) })); // or a shot on the ground just before it
  const tops = [...found].sort((a, b) => b.sc - a.sc).slice(0, 8);
  for (const t of tops) for (let jx = t.jx - 0.1; jx <= t.jx + 0.1; jx += 0.02) found.push(trial(Math.round(jx * 1000) / 1000, t.fire));
  const best = Math.max(...found.map((f) => f.sc));
  const good = found.filter((f) => f.sc >= best - 1e-9);
  const air = good.filter((g) => g.fire.air !== undefined), ground = good.filter((g) => g.fire.x !== undefined);
  const family = air.length >= ground.length ? air : ground; // the family with the wider window of good presses
  const mid = [...family].sort((a, b) => a.jx - b.jx)[Math.floor(family.length / 2)];
  const jxsGood = family.map((g) => g.jx);
  plan.jumpXs.push(mid.jx);
  if (mid.fire.x !== undefined) plan.fireXs = [mid.fire.x]; else plan.fireAfterJump = mid.fire.air;
  windows.push({ obstacle: `jump at ${e.name}`, best: mid.jx, lo: Math.min(...jxsGood), hi: Math.max(...jxsGood), widthMs: ((Math.max(...jxsGood) - Math.min(...jxsGood) + 0.02) / 7.4) * 1000 });
  return e.x;
}
// A big cannon: the barrel angle and where to fire, found together (the push goes forward and up by the angle, so the angle sets how far and how high).
// No jump is needed: the shot lifts the runner off the deck. A landing too hard for a straight-legged landing is rolled out by the base line.
function searchCannon(course: CourseData, plan: Plan, windows: Window[], score: (r: RunResult) => number, rp: RecoilParams, edgeX: number, name: string): number {
  type T = { sc: number; aim: number; fx: number };
  const trial = (aim: number, fx: number): T => ({ sc: score(playPlan(course, { ...plan, aim, fireXs: [fx] }, 120 * 30)), aim, fx });
  const found: T[] = [];
  const fxs = candidates(rp.x0 + 0.3, Math.max(rp.x0 + 0.3, edgeX - 0.5), 0.75);
  for (let a = 0.05; a <= AIM_MAX - 0.04; a += 0.05) for (const fx of fxs) found.push(trial(Math.round(a * 100) / 100, fx));
  const tops = [...found].sort((a, b) => b.sc - a.sc).slice(0, 6);
  for (const t of tops) for (let a = t.aim - 0.04; a <= t.aim + 0.04; a += 0.01) if (a >= 0) found.push(trial(Math.round(a * 1000) / 1000, t.fx));
  const best = Math.max(...found.map((f) => f.sc));
  const good = found.filter((f) => f.sc >= best - 1e-9);
  const mid = [...good].sort((a, b) => a.aim - b.aim)[Math.floor(good.length / 2)];
  plan.aim = mid.aim; plan.fireXs = [mid.fx];
  const aims = good.filter((g) => g.fx === mid.fx).map((g) => g.aim);
  windows.push({ obstacle: `cannon aim at ${name}`, best: mid.aim, lo: Math.min(...aims), hi: Math.max(...aims), widthMs: ((Math.max(...aims) - Math.min(...aims) + 0.01) / AIM_RATE) * 1000 }); // the time it takes to tilt across the window
  return edgeX;
}


// The elastic band: how far to stretch it before turning round, found together with the press at the edge after it (a stronger throw changes where the press is best).
function searchBand(course: CourseData, plan: Plan, windows: Window[], score: (r: RunResult) => number): number | null {
  const bp = bandParams(course);
  const e = edges(course).find((q) => q.x >= slackX(bp) - 0.01);
  if (!e) return null;
  const top = Math.max(1, Math.min(bp.snap - 0.6, reachableStretch(bp) * 1.2));
  const trial = (st: number, jx: number) => { const pl: Plan = { ...plan, bandStretch: st, jumpXs: [...plan.jumpXs, jx] }; return { sc: score(playPlan(course, pl, 120 * 40)), st, jx }; };
  const found: { sc: number; st: number; jx: number }[] = [];
  for (let st = Math.min(1, top); st <= top + 1e-9; st += top > 8 ? 1 : 0.5) for (const jx of candidates(e.x - 2.5, e.x, 0.25)) found.push(trial(st, jx));
  const tops = [...found].sort((a, b) => b.sc - a.sc).slice(0, 6);
  for (const t of tops) for (let st = Math.max(0.3, t.st - 0.6); st <= Math.min(top, t.st + 0.6) + 1e-9; st += 0.1) for (const jx of candidates(t.jx - 0.25, Math.min(e.x, t.jx + 0.25), 0.05)) found.push(trial(Math.round(st * 10) / 10, jx));
  const best = Math.max(...found.map((f) => f.sc));
  const good = found.filter((f) => f.sc >= best - 1e-9);
  const sts = [...new Set(good.map((g) => g.st))].sort((a, b) => a - b);
  const st = sts[Math.floor(sts.length / 2)]; // the middle of the stretches that work
  const jxs = good.filter((g) => g.st === st).map((g) => g.jx).sort((a, b) => a - b);
  const jx = jxs[Math.floor(jxs.length / 2)];
  plan.bandStretch = st; plan.jumpXs.push(jx);
  windows.push({ obstacle: 'band stretch', best: st, lo: sts[0], hi: sts[sts.length - 1], widthMs: ((sts[sts.length - 1] - sts[0] + 0.1) / 6) * 1000 });
  windows.push({ obstacle: `${e.name} (take-off)`, best: jx, lo: jxs[0], hi: jxs[jxs.length - 1], widthMs: ((jxs[jxs.length - 1] - jxs[0] + 0.05) / 11) * 1000 });
  return e.x;
}
const median = (xs: number[]): number => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

// Every combination of one value from each list.
function cross(lists: number[][]): number[][] {
  return lists.reduce<number[][]>((acc, l) => acc.flatMap((a) => l.map((v) => [...a, v])), [[]]);
}

// Tune how long to hang on bar i (ticks), keeping the others: the centre of the times that do best.
function* tuneHangGen(plan: Plan, i: number, windows: Window[], last: boolean, at: AtFn): Gen<void> {
  const ts: number[] = [];
  for (let t = 0; t <= 480; t += 6) ts.push(t);
  const sc: number[] = yield at(ts.map((t) => ({ plan: { ...plan, hangTicks: plan.hangTicks!.map((q, j) => (j === i ? t : q)) } })));
  const rs = ts.map((t, n) => ({ t, s: sc[n] }));
  const best = Math.max(...rs.map((r) => r.s));
  const good = rs.filter((r) => r.s >= best - 1e-9).map((r) => r.t);
  if (!good.length) return;
  plan.hangTicks![i] = good[Math.floor(good.length / 2)];
  if (last) windows.push({ obstacle: `hang on bar ${i + 1}`, best: plan.hangTicks![i], lo: Math.min(...good), hi: Math.max(...good), widthMs: (Math.max(...good) - Math.min(...good) + 6) * DT * 1000 });
}

function* tuneTicksGen(plan: Plan, key: 'releaseAfter' | 'bouncePress', from: number, to: number, windows: Window[], name: string, at: AtFn, stepSize = 2): Gen<void> {
  const ts: number[] = [];
  for (let t = from; t <= to; t += stepSize) ts.push(t);
  const sc: number[] = yield at(ts.map((t) => ({ plan: { ...plan, [key]: t } })));
  const rs = ts.map((t, n) => ({ t, s: sc[n] }));
  const best = Math.max(...rs.map((r) => r.s));
  const good = rs.filter((r) => r.s >= best - 1e-9).map((r) => r.t);
  const lo = Math.min(...good), hi = Math.max(...good);
  plan[key] = good[Math.floor(good.length / 2)];
  windows.push({ obstacle: name, best: plan[key], lo, hi, widthMs: ((hi - lo + stepSize) * DT) * 1000 });
}

// A player who is good but not perfect: every press is a little off (sigma in ms of game time), and a fall
// means starting again. Returns the game seconds until the first clear, or null if it never clears in `limitS`.
export function playImperfect(course: CourseData, plan: Plan, seed: number, sigmaMs: number, limitS = 180): number | null {
  let state = seed >>> 0 || 1;
  const rnd = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 2 ** 32; };
  const gauss = () => Math.sqrt(-2 * Math.log(Math.max(rnd(), 1e-12))) * Math.cos(2 * Math.PI * rnd());
  const sigmaX = (sigmaMs / 1000) * 7.4; // metres of run at about 7.4 m/s
  let total = 0;
  while (total < limitS) {
    const noisy: Plan = {
      jumpXs: plan.jumpXs.map((x) => x + gauss() * sigmaX),
      releaseAfter: Math.max(0, Math.round(plan.releaseAfter + (gauss() * sigmaMs) / (DT * 1000))),
      bouncePress: Math.max(0, Math.round(plan.bouncePress + (gauss() * sigmaMs) / (DT * 1000))),
    };
    const r = playPlan(course, noisy);
    total += r.world.runner.tick * DT + 1; // one second to restart
    if (r.world.outcome === 'cleared') return total;
  }
  return null;
}

// A coaster: the push is given at the start; the only thing to find is where to brake. Every time the cart leaves the track on a crest, try braking
// through that crest from a point earlier on (the nearest start that makes the whole course clear), then look at the next crest.
// A coaster is ridden well when the cart rolls home on the rails: finishing by flying off a hilltop, landing on the track and running on is not a ride.
const rode = (r: RunResult): boolean => r.world.outcome === 'cleared' && !flewOff(r.events);
// The drone ferry: where to start leaning back and where to start climbing down so the drone lands softly on the far deck. A bounded grid, then a finer one around the fastest line.
export function searchDroneRun(course: CourseData): { plan: Plan; windows: Window[]; cleared: boolean } {
  const d = course.drone!;
  const plan: Plan = { jumpXs: [], releaseAfter: 60, bouncePress: 8 };
  const windows: Window[] = [];
  const far = [...course.terrain.platforms].sort((a, b) => a.x0 - b.x0).find((p) => p.x0 > d.x1 + 3);
  if (!far) return { plan, windows, cleared: false };
  const cap = 120 * 60;
  type T = { b: number; c: number; ok: boolean; t: number };
  const found: T[] = [];
  const trial = (b: number, c: number) => { const r = playPlan(course, { ...plan, droneBrakeX: b, droneDescendX: c }, cap); found.push({ b, c, ok: r.world.outcome === 'cleared', t: r.world.runner.tick }); };
  for (let b = d.x1 + 3; b <= far.x0 + 1; b += 2) for (let c = far.x0 - 6; c <= Math.min(far.x1 - 2, far.x0 + 12); c += 2) trial(b, c);
  const first = found.filter((f) => f.ok).sort((a, b) => a.t - b.t)[0];
  if (first) for (let b = first.b - 2; b <= first.b + 2; b += 0.5) for (let c = first.c - 2; c <= first.c + 2; c += 0.5) trial(b, c);
  const good = found.filter((f) => f.ok);
  if (!good.length) return { plan, windows, cleared: false };
  const best = good.sort((a, b) => a.t - b.t)[0];
  plan.droneBrakeX = best.b; plan.droneDescendX = best.c;
  const brakes = good.filter((g) => Math.abs(g.c - best.c) < 0.01).map((g) => g.b);
  windows.push({ obstacle: 'braking point', best: best.b, lo: Math.min(...brakes), hi: Math.max(...brakes), widthMs: ((Math.max(...brakes) - Math.min(...brakes) + 0.5) / 8) * 1000 });
  return { plan, windows, cleared: true };
}

// A coaster with bars (CC-244): the cart hands the rider to the ordinary flight at the end of a section, so the hands go up there and each bar gets a hang time.
// The hang times of the first two bars are tried on a grid (a catch and the next catch depend on each other), each with the brake search below.
export function searchCartRun(course: CourseData): { plan: Plan; windows: Window[]; cleared: boolean } {
  const holds = course.holds ?? [];
  if (!holds.length) return searchCartBrakes(course, { jumpXs: [], releaseAfter: 60, bouncePress: 8, cartBrake: [] });
  const grid = [0, 15, 30, 45, 60, 90, 120, 160, 200];
  let fallback: { plan: Plan; windows: Window[]; cleared: boolean } | null = null;
  for (const h1 of grid) for (const h2 of holds.length > 1 ? grid : [0]) {
    const hangTicks = holds.map((_, i) => (i === 0 ? h1 : i === 1 ? h2 : 90));
    const found = searchCartBrakes(course, { jumpXs: [], releaseAfter: 60, bouncePress: 8, cartBrake: [], hands: true, hangTicks });
    if (found.cleared) return found;
    fallback ??= found;
  }
  return fallback!;
}

function searchCartBrakes(course: CourseData, plan: Plan): { plan: Plan; windows: Window[]; cleared: boolean } {
  const windows: Window[] = [];
  const cap = 120 * 90;
  for (let round = 0; round < 5; round++) {
    const r = playPlan(course, plan, cap);
    if (rode(r)) return { plan, windows, cleared: true };
    const off = r.events.find((e) => e.type === 'cart-off' && !e.detail?.end);
    if (!off) return { plan, windows, cleared: false }; // stalled or something else: braking cannot help
    const xOff = off.detail!.x as number;
    const x0 = course.track!.pts.reduce((m, q) => Math.min(m, q[0]), Infinity);
    const best: { a: number; ok: boolean; cleared: boolean }[] = [];
    for (let a = xOff - 1; a >= x0; a -= 1) {
      const trial: Plan = { ...plan, cartBrake: [...plan.cartBrake!, [a, xOff + 1]] };
      const rr = playPlan(course, trial, cap);
      const cleared = rode(rr);
      const left = rr.events.find((e) => e.type === 'cart-off' && !e.detail?.end);
      best.push({ a, cleared, ok: cleared || !left || (left.detail!.x as number) > xOff + 1 });
    }
    const good = best.some((b) => b.cleared) ? best.filter((b) => b.cleared) : best.filter((b) => b.ok); // starts that clear the whole course first; else any that gets over this crest
    if (!good.length) return { plan, windows, cleared: false };
    const lo = Math.min(...good.map((g) => g.a)), hi = Math.max(...good.map((g) => g.a));
    const pick = good[Math.floor(good.length / 2)].a; // the middle of the starts that work
    plan.cartBrake!.push([pick, xOff + 1]);
    windows.push({ obstacle: `crest at ${xOff.toFixed(0)} m`, best: pick, lo, hi, widthMs: ((hi - lo + 1) / 8) * 1000 });
  }
  return { plan, windows, cleared: rode(playPlan(course, plan, cap)) };
}
