import type { CourseData } from '../course/course';
import { NO_INPUT, type RunnerInput } from './runner';
import { newWorld, stepWorld, type GameEvent, type WorldState } from './world';
import { DT } from './units';

// The ideal run: where to press Space at each obstacle, found by trying the simulator, and how wide the
// window of good presses is. It is the difficulty of each obstacle as a number.
export interface Plan {
  jumpXs: number[]; // press at the first moment the feet are on the ground at or past this x
  releaseAfter: number; // ticks after catching the rope
  bouncePress: number; // ticks after touching the trampoline bed
  vaultXs?: number[]; // press V at the first moment the feet are on the ground at or past this x
  hands?: boolean; // hold the hand key while airborne (so a bar in reach is grabbed)
  hangTicks?: number[]; // per bar: ticks to hang (pumping with the swing) before letting go
}

export interface Window {
  obstacle: string;
  best: number; // ideal value (x in m, or ticks)
  lo: number;
  hi: number;
  widthMs: number; // how long the clearing window lasts, in milliseconds of game time
}

export function inputFor(plan: Plan, w: WorldState, state: { next: number; caught: number | null; bedAt: number | null; hangAt?: number | null; hangs?: number; vnext?: number }): RunnerInput {
  const base: RunnerInput = { ...NO_INPUT, run: true, squat: true };
  if (w.mode === 'hang') {
    if (state.hangAt == null) state.hangAt = w.runner.tick;
    const idx = state.hangs ?? 0;
    if (w.runner.tick - state.hangAt >= (plan.hangTicks?.[idx] ?? 90)) { state.hangAt = null; state.hangs = idx + 1; return base; } // let go
    const forward = (w.hang?.omega ?? 0) >= 0; // pump the way the body is moving: more swing
    return { ...NO_INPUT, squat: true, handL: true, handR: true, run: forward, left: !forward };
  }
  state.hangAt = null;
  if (plan.hands && w.mode === 'run' && !w.runner.grounded) return { ...base, handR: true };
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
  const st = { next: 0, caught: null as number | null, bedAt: null as number | null, hangAt: null as number | null, hangs: 0, vnext: 0 };
  const events: GameEvent[] = [];
  let maxX = 0;
  let still = 0;
  for (let i = 0; i < maxTicks && w.outcome === 'running'; i++) {
    w = stepWorld(w, inputFor(plan, w, st), course);
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
    if (nxt && nxt.x0 - p.x1 > 0.01 && p.x1 >= course.startX) out.push({ x: p.x1, name: `edge at ${p.x1} m` }); // edges behind the start are not part of this run
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
export function searchIdealRun(course: CourseData): { plan: Plan; windows: Window[]; cleared: boolean } {
  const holds = course.holds ?? [];
  const plan: Plan = { jumpXs: [], releaseAfter: 60, bouncePress: 8, ...(holds.length ? { hands: true, hangTicks: holds.map(() => 90) } : {}) };
  const windows: Window[] = [];
  const es: { x: number; name: string; riser?: boolean }[] = [...edges(course), ...risers(course)].sort((a, b) => a.x - b.x);
  const hasRope = !!course.rope;
  // rope: the jump at the deck edge before the rope's gap is one of the edges; tune the release after it
  const score = (r: RunResult) => (r.world.outcome === 'cleared' ? 1e6 : r.maxX);
  const progress = (): void => {};
  void progress;
  for (let k = 0; k < es.length; k++) {
    const e = es[k];
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
      if (!done) {
        const tops = [...found].sort((a, b) => b.sc - a.sc).slice(0, 3);
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
      for (const x of candidates(e.x - 1.2, e.x - 0.05)) for (const vault of [false, true]) {
        const trial: Plan = vault ? { ...plan, vaultXs: [...(plan.vaultXs ?? []), x] } : { ...plan, jumpXs: [...plan.jumpXs, x] };
        tries.push({ x, vault, s: score(playPlan(course, trial)) });
      }
      const top = Math.max(...tries.map((t) => t.s));
      const good = tries.filter((t) => t.s >= top - (top >= 1e6 ? 1e-9 : 0.3)); // before the rest of the course is planned the score is how far the run gets: near ties count as ties
      // the centre of the window of presses that work (a vault wins a tie with a jump: it is faster), not its edge
      const kind = good.some((t) => t.vault);
      const mine = good.filter((t) => t.vault === kind).map((t) => t.x);
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
  return { plan, windows, cleared: final.world.outcome === 'cleared' };
}

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
