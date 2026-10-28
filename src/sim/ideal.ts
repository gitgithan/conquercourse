import type { CourseData } from '../course/course';
import { NO_INPUT, type RunnerInput } from './runner';
import { newWorld, recoilParams, stepWorld, type GameEvent, type WorldState } from './world';
import { DT } from './units';
import { rollNeeded } from './drop';

// The ideal run: where to press Space at each obstacle, found by trying the simulator, and how wide the
// window of good presses is. It is the difficulty of each obstacle as a number.
export interface Plan {
  jumpXs: number[]; // press at the first moment the feet are on the ground at or past this x
  releaseAfter: number; // ticks after catching the rope
  bouncePress: number; // ticks after touching the trampoline bed
  vaultXs?: number[]; // press V at the first moment the feet are on the ground at or past this x
  hands?: boolean; // hold the hand key while airborne (so a bar in reach is grabbed)
  hangTicks?: number[]; // per bar: ticks to hang (pumping with the swing) before letting go
  airHands?: boolean[]; // per release: hold the hand key in the air afterwards (default true); false flies past the next bar (a skip)
  launchRelease?: number; // trebuchet: ticks after the pin is pulled at which Space lets the rider go
  fireXs?: number[]; // a launcher (recoil pad): press K at the first moment the runner is at or past this x
  fireAfterJump?: number; // or press K this many ticks after the take-off, so the shot adds to a jump
  cartBrake?: [number, number][]; // a coaster: hold the brake between these x values (the first push is always given at the start)
}

export interface Window {
  obstacle: string;
  best: number; // ideal value (x in m, or ticks)
  lo: number;
  hi: number;
  widthMs: number; // how long the clearing window lasts, in milliseconds of game time
}

type PlanState = { next: number; caught: number | null; bedAt: number | null; hangAt?: number | null; hangs?: number; vnext?: number; fnext?: number; airSince?: number | null };
// The launcher (recoil): fire at a place along the run, or a number of ticks after the take-off (a shot in the air adds to a jump)
export function inputFor(plan: Plan, w: WorldState, state: PlanState, course?: CourseData): RunnerInput {
  const inp = inputForBase(plan, w, state, course);
  if (w.mode !== 'run') return inp;
  if (w.runner.grounded) state.airSince = null; else if (state.airSince == null) state.airSince = w.runner.tick;
  if (!w.recoil || w.recoil.armed <= 0) return inp;
  const byX = plan.fireXs && (state.fnext ?? 0) < plan.fireXs.length && w.runner.x >= plan.fireXs[state.fnext ?? 0];
  const byAir = plan.fireAfterJump !== undefined && state.airSince != null && w.runner.tick - state.airSince >= plan.fireAfterJump;
  if (!byX && !byAir) return inp;
  state.fnext = (state.fnext ?? 0) + 1;
  return { ...inp, fire: true };
}
function inputForBase(plan: Plan, w: WorldState, state: PlanState, course?: CourseData): RunnerInput {
  if (w.mode === 'cart') { // the cart: push at the start, brake where the plan says
    const x = w.runner.x;
    return { ...NO_INPUT, run: !w.cart?.started, squat: !!plan.cartBrake?.some(([a, b]) => x >= a && x <= b) };
  }
  const base: RunnerInput = { ...NO_INPUT, run: true, squat: true, ...(course && rollNeeded(w, course) ? { roll: true } : {}) }; // a drop a squat cannot take cleanly: roll just before the ground
  if (w.mode === 'launch') return { ...NO_INPUT, run: true, squat: true, ...(w.launch?.fired && w.launch.t >= (plan.launchRelease ?? 120) ? { jump: true } : {}) }; // pull the pin, then let go at the planned moment
  if (w.mode === 'hang') {
    if (state.hangAt == null) state.hangAt = w.runner.tick;
    const idx = state.hangs ?? 0;
    if (w.runner.tick - state.hangAt >= (plan.hangTicks?.[idx] ?? 90)) { state.hangAt = null; state.hangs = idx + 1; return base; } // let go
    const forward = (w.hang?.omega ?? 0) >= 0; // pump the way the body is moving: more swing
    return { ...NO_INPUT, squat: true, handL: true, handR: true, run: forward, left: !forward };
  }
  state.hangAt = null;
  if (plan.hands && w.mode === 'run' && !w.runner.grounded && plan.airHands?.[(state.hangs ?? 0) - 1] !== false) return { ...base, handR: true };
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

export interface RunResult { world: WorldState; events: GameEvent[]; maxX: number; jumps: number }

export function playPlan(course: CourseData, plan: Plan, maxTicks = 120 * 80): RunResult {
  let w = newWorld(course);
  const st = { next: 0, caught: null as number | null, bedAt: null as number | null, hangAt: null as number | null, hangs: 0, vnext: 0, fnext: 0, airSince: null as number | null };
  const events: GameEvent[] = [];
  let maxX = 0;
  let still = 0;
  for (let i = 0; i < maxTicks && w.outcome === 'running'; i++) {
    w = stepWorld(w, inputFor(plan, w, st, course), course);
    events.push(...w.events);
    if (!Number.isFinite(w.runner.x)) break; // a state that went to NaN has nowhere to go
    maxX = Math.max(maxX, w.runner.x);
    // a runner pressed against something it cannot pass will never get anywhere: stop after 1.5 s of standing still (it only costs time to go on)
    still = w.mode === 'run' && w.runner.grounded && Math.abs(w.runner.vx) < 0.01 ? still + 1 : 0;
    if (still > 180) break;
  }
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

// Steps up that touch the ground before them and are too tall to walk up (0.3 m) but within a vault's reach (the wall is another move).
export function risers(course: CourseData): { x: number; name: string; riser: true }[] {
  const ps = [...course.terrain.platforms].sort((a, b) => a.x0 - b.x0);
  const out: { x: number; name: string; riser: true }[] = [];
  ps.forEach((p, i) => {
    const nxt = ps[i + 1];
    if (!nxt || nxt.x0 - p.x1 > 0.02 || p.x1 < course.startX) return;
    const rise = nxt.top - p.top;
    if (rise > 0.3 && rise <= 1.3 && !(course.wall && Math.abs(nxt.x0 - (course.wall.x0 + (course.wall.radius ?? course.wall.height ?? 4.3))) < 0.5)) out.push({ x: p.x1, name: `step at ${p.x1} m`, riser: true });
  });
  return out;
}

const candidates = (from: number, to: number, step = 0.02) => {
  const out: number[] = [];
  for (let x = from; x <= to + 1e-9; x += step) out.push(Math.round(x * 1000) / 1000);
  return out;
}

// Greedy search: for each obstacle in order, try presses and keep the ones that reach farthest; the centre of the
// best group is the ideal press and the group's width is the clearing window.
// One way through a course with bars, with the time it takes (ticks at 120 Hz); `chosen` marks the faster one the plan follows.
export interface Route { name: string; ticks: number; bars: number; chosen: boolean }

export function searchIdealRun(course: CourseData, opts: { routes?: boolean } = {}): { plan: Plan; windows: Window[]; cleared: boolean; routes?: Route[] } {
  if (course.track) return searchCartRun(course);
  const holds = course.holds ?? [];
  const plan: Plan = { jumpXs: [], releaseAfter: 60, bouncePress: 8, ...(holds.length ? { hands: true, hangTicks: holds.map(() => 90) } : {}) };
  const windows: Window[] = [];
  const tre = course.trebuchet;
  const onMachine = (x: number) => !!tre && course.terrain.platforms.some((p) => p.x0 <= tre.x && tre.x <= p.x1 && x >= p.x0 && x <= p.x1 + 0.01); // the machine's own deck: nobody runs off it, the rider is thrown
  const es: { x: number; name: string; riser?: boolean }[] = [...edges(course), ...risers(course)].filter((e) => !onMachine(e.x)).sort((a, b) => a.x - b.x);
  const hasRope = !!course.rope;
  // rope: the jump at the deck edge before the rope's gap is one of the edges; tune the release after it
  const score = (r: RunResult) => (r.world.outcome === 'cleared' ? 1e6 : r.maxX);
  const progress = (): void => {};
  void progress;
  if (tre) searchLaunch(course, plan, windows, score);
  const handled = course.recoil ? searchRecoil(course, plan, windows, score) : null; // the first gap after the pad is planned together with the shot
  for (let k = 0; k < es.length; k++) {
    const e = es[k];
    if (handled !== null && Math.abs(e.x - handled) < 0.01) continue;
    // bars within a swing of this edge: a joint search over the press and the hang times on the first two bars (a swing and the next catch depend on each other,
    // so tuning one at a time misses lines that clear), coarse first, then finer around the best few
    if (!e.riser && holds.some((h) => h.x > e.x - 1 && h.x < e.x + 9) && plan.hangTicks) {
      const nh = Math.min(2, plan.hangTicks.length);
      const trial = (jx: number, hs: number[]): { sc: number; plan: Plan } => {
        const ht = plan.hangTicks!.map((t, i) => (i < nh ? hs[i] : t));
        const pl: Plan = { ...plan, jumpXs: [...plan.jumpXs, jx], hangTicks: ht };
        return { sc: score(playPlan(course, pl, 120 * 25)), plan: pl };
      };
      let found: { sc: number; plan: Plan }[] = [];
      const grid = (jxs: number[], hang: number[][]) => {
        for (const jx of jxs) for (const hs of cross(hang)) { const t = trial(jx, hs); found.push(t); if (t.sc >= 1e6) return true; }
        return false;
      };
      const hangVals = (from: number, to: number, step: number) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);
      let done = grid(candidates(e.x - 3, e.x, 0.3), Array.from({ length: nh }, () => hangVals(0, 480, 30)));
      // a narrow basin can fall between the coarse hang times: shift the grid by half a step before refining
      if (!done) done = grid(candidates(e.x - 3, e.x, 0.3), Array.from({ length: nh }, () => hangVals(15, 465, 30)));
      if (!done) {
        const tops = [...found].sort((a, b) => b.sc - a.sc).slice(0, 8); // the coarse grid misses a narrow basin, so the finer search tries more of the best starts
        for (const t of tops) {
          const jx = t.plan.jumpXs[t.plan.jumpXs.length - 1];
          done = grid(candidates(jx - 0.25, jx + 0.25, 0.05), t.plan.hangTicks!.slice(0, nh).map((h) => hangVals(Math.max(0, h - 24), h + 24, 6)));
          if (done) break;
        }
      }
      const win = found.reduce((a, b) => (b.sc > a.sc ? b : a));
      plan.jumpXs = win.plan.jumpXs; plan.hangTicks = win.plan.hangTicks;
      windows.push({ obstacle: `${e.name} (take-off)`, best: plan.jumpXs[plan.jumpXs.length - 1], lo: plan.jumpXs[plan.jumpXs.length - 1], hi: plan.jumpXs[plan.jumpXs.length - 1], widthMs: 0 });
      for (let pass = 0; pass < 2; pass++) for (let i = 0; i < plan.hangTicks!.length; i++) tuneHang(course, plan, i, windows, score, pass === 1);
      continue;
    }
    if (e.riser) {
      // a step up too tall for a casual walk-up: try a vault and a jump at every press, keep the one that gets farthest (a vault wins a tie: it is faster)
      const tries: { x: number; vault: boolean; s: number }[] = [];
      // a vault plants further back (a speed vault: 1 to 3 m before the face, plus the 0.2 s a press is held), so its presses are searched on a wider, coarser grid
      for (const vault of [false, true]) for (const x of vault ? candidates(e.x - 5, e.x - 0.05, 0.04) : candidates(e.x - 1.2, e.x - 0.05)) {
        const trial: Plan = vault ? { ...plan, vaultXs: [...(plan.vaultXs ?? []), x] } : { ...plan, jumpXs: [...plan.jumpXs, x] };
        tries.push({ x, vault, s: score(playPlan(course, trial)) });
      }
      const top = Math.max(...tries.map((t) => t.s));
      const good = tries.filter((t) => t.s >= top - (top >= 1e6 ? 1e-9 : 0.3)); // before the rest of the course is planned the score is how far the run gets: near ties count as ties
      // the centre of the window of presses that work (a vault wins a tie with a jump: it is faster), not its edge
      const kind = good.some((t) => t.vault);
      let mine = good.filter((t) => t.vault === kind).map((t) => t.x);
      // a vault pressed further out than its reach is held by the 0.2 s buffer until the step is in reach: for a plan, take the middle of the presses made at a real plant distance (up to 2.7 m before the face)
      if (kind) { const near = mine.filter((x) => x >= e.x - 2.7); if (near.length) mine = near; }
      const best = mine.length ? { x: mine[Math.floor(mine.length / 2)], vault: kind } : null;
      if (best) { if (best.vault) plan.vaultXs = [...(plan.vaultXs ?? []), best.x]; else plan.jumpXs.push(best.x); windows.push({ obstacle: `${best.vault ? 'vault' : 'jump'} at ${e.name}`, best: best.x, lo: Math.min(...mine), hi: Math.max(...mine), widthMs: ((Math.max(...mine) - Math.min(...mine) + 0.02) / 7.4) * 1000 }); }
      continue;
    }
    // a bar within a swing of this edge: try presses on a coarser grid and, for each, several hang times on the first bar
    const holdEdge = holds.some((h) => h.x > e.x - 1 && h.x < e.x + 9);
    const cs = candidates(e.x - 3, e.x, holdEdge ? 0.1 : 0.02);
    // the runner jumps from a platform: the press must happen while still on it
    const ropeEdge = hasRope && e.x < course.rope!.anchorX && e.x > course.rope!.anchorX - 8;
    const releases = ropeEdge ? Array.from({ length: 21 }, (_, i) => i * 15) : [plan.releaseAfter];
    const hangOptions = holdEdge ? Array.from({ length: 13 }, (_, i) => i * 30) : [0];
    const results = cs.map((x) => {
      // at the rope's edge a press is good if SOME release timing then clears, so try several
      let bestS = -1;
      let r = playPlan(course, { ...plan, jumpXs: [...plan.jumpXs, x] });
      for (const rel of releases) for (const hang of hangOptions) {
        const ht = holdEdge && plan.hangTicks ? plan.hangTicks.map((t, i) => (i === 0 ? hang : t)) : plan.hangTicks;
        const rr = playPlan(course, { ...plan, jumpXs: [...plan.jumpXs, x], releaseAfter: rel, hangTicks: ht });
        const sc = score(rr);
        if (sc > bestS) { bestS = sc; r = rr; }
      }
      return { x, s: bestS, r };
    });
    // a press is good if the run then gets farther than any press can do by standing still at the edge
    const best = Math.max(...results.map((r) => r.s));
    const good = results.filter((r) => r.s >= best - 1e-9);
    // group = the longest run of consecutive candidates that all reach `best`
    const xs = good.map((g) => g.x);
    const lo = Math.min(...xs), hi = Math.max(...xs);
    const mid = good[Math.floor(good.length / 2)].x;
    plan.jumpXs.push(mid);
    const speed = 7.4;
    windows.push({ obstacle: e.name, best: mid, lo, hi, widthMs: ((hi - lo + 0.02) / speed) * 1000 });
    // tune the rope release and the bounce press once the runner can reach them
    if (ropeEdge) tuneTicks(course, plan, 'releaseAfter', 0, 360, windows, 'rope release', score);
    if (holdEdge && plan.hangTicks) for (let pass = 0; pass < 2; pass++) for (let i = 0; i < plan.hangTicks.length; i++) tuneHang(course, plan, i, windows, score, pass === 1);
    if (e.x > 117 && e.x < 119) {
      tuneTicks(course, plan, 'bouncePress', 0, 40, windows, 'trampoline press', score, 1);
    }
  }
  const final = playPlan(course, plan);
  if (opts.routes && holds.length >= 2 && plan.hangTicks && final.world.outcome === 'cleared') return { ...compareRoutes(course, plan, final, windows), windows };
  return { plan, windows, cleared: final.world.outcome === 'cleared' };
}

// Two ways through a pair of bars (asked for with `{ routes: true }`: it adds about 250 runs, so the stored plans and the tests that need it use it, not every search):
// bar to bar (the plan the search found), or a full pump on the first bar and a flight over the second (a skip).
// Both are tried and the shorter total time is the line the plan follows; both are reported (the hint and the debug view say what is possible, as a fact).
function compareRoutes(course: CourseData, plan: Plan, base: RunResult, windows: Window[]): { plan: Plan; cleared: boolean; routes: Route[] } {
  const catches = (r: RunResult) => r.events.filter((e) => e.type === 'hang-catch').length;
  const baseBars = catches(base);
  type Opt = { plan: Plan; ticks: number; bars: number };
  const jx0 = plan.jumpXs[plan.jumpXs.length - 1];
  // bar to bar: the fastest way that catches both bars (the plan found may fly over the second one by luck, so the two ways are searched on their own)
  let viaBars: Opt | null = baseBars >= 2 ? { plan, ticks: base.world.runner.tick, bars: baseBars } : null;
  for (let h1 = 0; h1 <= 300; h1 += 30) for (let h2 = 0; h2 <= 480; h2 += 30) {
    const pl: Plan = { ...plan, hangTicks: [h1, h2, ...(plan.hangTicks?.slice(2) ?? [])] };
    delete pl.airHands;
    const r = playPlan(course, pl, 120 * 40);
    if (r.world.outcome === 'cleared' && catches(r) >= 2 && (!viaBars || r.world.runner.tick < viaBars.ticks)) viaBars = { plan: pl, ticks: r.world.runner.tick, bars: catches(r) };
  }
  // skip: a full pump on the first bar and the hand kept off in the air, so the second bar is flown over
  let skip: Opt | null = baseBars === 1 ? { plan, ticks: base.world.runner.tick, bars: 1 } : null;
  const skipPlan = (h: number, jx: number): Plan => ({ ...plan, jumpXs: [...plan.jumpXs.slice(0, -1), jx], hangTicks: [h], airHands: [false] });
  const tryHang = (jx: number, hs: number[]) => {
    for (const h of hs) {
      const r = playPlan(course, skipPlan(h, jx), 120 * 40);
      if (r.world.outcome === 'cleared' && catches(r) === 1 && (!skip || r.world.runner.tick < skip.ticks)) skip = { plan: skipPlan(h, jx), ticks: r.world.runner.tick, bars: 1 };
    }
  };
  const coarse = Array.from({ length: 91 }, (_, i) => i * 6);
  for (const jx of [jx0, ...[-0.3, -0.2, -0.1, 0.1, 0.2, 0.3].map((d) => Math.round((jx0 + d) * 100) / 100)]) { tryHang(jx, coarse); if (skip && skip.plan.airHands) break; }
  if (skip && skip.plan.airHands) { const b = skip as Opt; tryHang(b.plan.jumpXs[b.plan.jumpXs.length - 1], Array.from({ length: 13 }, (_, i) => Math.max(0, b.plan.hangTicks![0] - 6 + i))); }
  const opts = [viaBars && { name: 'bar to bar', ...viaBars }, skip && { name: 'skip the second bar', ...(skip as Opt) }].filter((o): o is Opt & { name: string } => !!o);
  if (!opts.length) return { plan, cleared: true, routes: [{ name: baseBars >= 2 ? 'bar to bar' : 'one bar', ticks: base.world.runner.tick, bars: baseBars, chosen: true }] };
  const fastest = opts.reduce((a, b) => (b.ticks < a.ticks ? b : a));
  const routes: Route[] = opts.map((o) => ({ name: o.name, ticks: o.ticks, bars: o.bars, chosen: o === fastest }));
  if (fastest.name.startsWith('skip')) windows.push({ obstacle: 'skip the second bar', best: fastest.plan.hangTicks![0], lo: fastest.plan.hangTicks![0], hi: fastest.plan.hangTicks![0], widthMs: DT * 1000 });
  return { plan: fastest.plan, cleared: true, routes };
}

// The trebuchet: when to let the rider go (ticks after the pin), found together with the hang time on the first bar when there is one.
function searchLaunch(course: CourseData, plan: Plan, windows: Window[], score: (r: RunResult) => number) {
  const bars = (course.holds ?? []).length > 0;
  const trial = (rel: number, hang: number): { sc: number; rel: number; hang: number } => {
    const pl: Plan = { ...plan, launchRelease: rel, ...(bars ? { hangTicks: plan.hangTicks!.map((t, i) => (i === 0 ? hang : t)) } : {}) };
    return { sc: score(playPlan(course, pl, 120 * 30)), rel, hang };
  };
  const hangs = bars ? Array.from({ length: 17 }, (_, i) => i * 30) : [0];
  let found: { sc: number; rel: number; hang: number }[] = [];
  for (let rel = 20; rel <= 360; rel += 6) for (const h of hangs) { found.push(trial(rel, h)); }
  const tops = [...found].sort((a, b) => b.sc - a.sc).slice(0, 8); // the coarse grid misses a narrow basin, so the finer search tries more of the best starts
  for (const t of tops) for (let rel = t.rel - 6; rel <= t.rel + 6; rel += 1) for (let h = Math.max(0, t.hang - 24); h <= t.hang + 24; h += bars ? 6 : 100) found.push(trial(rel, h));
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
const median = (xs: number[]): number => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

// Every combination of one value from each list.
function cross(lists: number[][]): number[][] {
  return lists.reduce<number[][]>((acc, l) => acc.flatMap((a) => l.map((v) => [...a, v])), [[]]);
}

// Tune how long to hang on bar i (ticks), keeping the others: the centre of the times that do best.
function tuneHang(course: CourseData, plan: Plan, i: number, windows: Window[], score: (r: RunResult) => number, last: boolean) {
  const rs: { t: number; s: number }[] = [];
  for (let t = 0; t <= 480; t += 6) rs.push({ t, s: score(playPlan(course, { ...plan, hangTicks: plan.hangTicks!.map((q, j) => (j === i ? t : q)) })) });
  const best = Math.max(...rs.map((r) => r.s));
  const good = rs.filter((r) => r.s >= best - 1e-9).map((r) => r.t);
  if (!good.length) return;
  plan.hangTicks![i] = good[Math.floor(good.length / 2)];
  if (last) windows.push({ obstacle: `hang on bar ${i + 1}`, best: plan.hangTicks![i], lo: Math.min(...good), hi: Math.max(...good), widthMs: (Math.max(...good) - Math.min(...good) + 6) * DT * 1000 });
}

function tuneTicks(course: CourseData, plan: Plan, key: 'releaseAfter' | 'bouncePress', from: number, to: number, windows: Window[], name: string, score: (r: RunResult) => number, stepSize = 2) {
  const rs: { t: number; s: number }[] = [];
  for (let t = from; t <= to; t += stepSize) rs.push({ t, s: score(playPlan(course, { ...plan, [key]: t })) });
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
export function searchCartRun(course: CourseData): { plan: Plan; windows: Window[]; cleared: boolean } {
  const plan: Plan = { jumpXs: [], releaseAfter: 60, bouncePress: 8, cartBrake: [] };
  const windows: Window[] = [];
  const cap = 120 * 90;
  for (let round = 0; round < 5; round++) {
    const r = playPlan(course, plan, cap);
    if (r.world.outcome === 'cleared') return { plan, windows, cleared: true };
    const off = r.events.find((e) => e.type === 'cart-off');
    if (!off) return { plan, windows, cleared: false }; // stalled or something else: braking cannot help
    const xOff = off.detail!.x as number;
    const x0 = course.track!.pts.reduce((m, q) => Math.min(m, q[0]), Infinity);
    const best: { a: number; ok: boolean; cleared: boolean }[] = [];
    for (let a = xOff - 1; a >= x0; a -= 1) {
      const trial: Plan = { ...plan, cartBrake: [...plan.cartBrake!, [a, xOff + 1]] };
      const rr = playPlan(course, trial, cap);
      const cleared = rr.world.outcome === 'cleared';
      const left = rr.events.find((e) => e.type === 'cart-off');
      best.push({ a, cleared, ok: cleared || !left || (left.detail!.x as number) > xOff + 1 });
    }
    const good = best.some((b) => b.cleared) ? best.filter((b) => b.cleared) : best.filter((b) => b.ok); // starts that clear the whole course first; else any that gets over this crest
    if (!good.length) return { plan, windows, cleared: false };
    const lo = Math.min(...good.map((g) => g.a)), hi = Math.max(...good.map((g) => g.a));
    const pick = good[Math.floor(good.length / 2)].a; // the middle of the starts that work
    plan.cartBrake!.push([pick, xOff + 1]);
    windows.push({ obstacle: `crest at ${xOff.toFixed(0)} m`, best: pick, lo, hi, widthMs: ((hi - lo + 1) / 8) * 1000 });
  }
  return { plan, windows, cleared: playPlan(course, plan, cap).world.outcome === 'cleared' };
}
