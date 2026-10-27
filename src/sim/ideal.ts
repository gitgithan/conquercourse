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
}

export interface Window {
  obstacle: string;
  best: number; // ideal value (x in m, or ticks)
  lo: number;
  hi: number;
  widthMs: number; // how long the clearing window lasts, in milliseconds of game time
}

export function inputFor(plan: Plan, w: WorldState, state: { next: number; caught: number | null; bedAt: number | null }): RunnerInput {
  const base: RunnerInput = { ...NO_INPUT, run: true, squat: true };
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
  if (w.runner.grounded && state.next < plan.jumpXs.length && w.runner.x >= plan.jumpXs[state.next]) {
    state.next++;
    return { ...base, jump: true };
  }
  return base;
}

export interface RunResult { world: WorldState; events: GameEvent[]; maxX: number; jumps: number }

export function playPlan(course: CourseData, plan: Plan, maxTicks = 120 * 80): RunResult {
  let w = newWorld(course);
  const st = { next: 0, caught: null as number | null, bedAt: null as number | null };
  const events: GameEvent[] = [];
  let maxX = 0;
  let still = 0;
  for (let i = 0; i < maxTicks && w.outcome === 'running'; i++) {
    w = stepWorld(w, inputFor(plan, w, st), course);
    events.push(...w.events);
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

const candidates = (from: number, to: number, step = 0.02) => {
  const out: number[] = [];
  for (let x = from; x <= to + 1e-9; x += step) out.push(Math.round(x * 1000) / 1000);
  return out;
}

// Greedy search: for each obstacle in order, try presses and keep the ones that reach farthest; the centre of the
// best group is the ideal press and the group's width is the clearing window.
export function searchIdealRun(course: CourseData): { plan: Plan; windows: Window[]; cleared: boolean } {
  const plan: Plan = { jumpXs: [], releaseAfter: 60, bouncePress: 8 };
  const windows: Window[] = [];
  const es = edges(course);
  const hasRope = !!course.rope;
  // rope: the jump at the deck edge before the rope's gap is one of the edges; tune the release after it
  const score = (r: RunResult) => (r.world.outcome === 'cleared' ? 1e6 : r.maxX);
  const progress = (): void => {};
  void progress;
  for (let k = 0; k < es.length; k++) {
    const e = es[k];
    const cs = candidates(e.x - 3, e.x);
    // the runner jumps from a platform: the press must happen while still on it
    const ropeEdge = hasRope && e.x < course.rope!.anchorX && e.x > course.rope!.anchorX - 8;
    const releases = ropeEdge ? Array.from({ length: 21 }, (_, i) => i * 15) : [plan.releaseAfter];
    const results = cs.map((x) => {
      // at the rope's edge a press is good if SOME release timing then clears, so try several
      let bestS = -1;
      let r = playPlan(course, { ...plan, jumpXs: [...plan.jumpXs, x] });
      for (const rel of releases) {
        const rr = playPlan(course, { ...plan, jumpXs: [...plan.jumpXs, x], releaseAfter: rel });
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
    if (e.x > 117 && e.x < 119) {
      tuneTicks(course, plan, 'bouncePress', 0, 40, windows, 'trampoline press', score, 1);
    }
  }
  const final = playPlan(course, plan);
  return { plan, windows, cleared: final.world.outcome === 'cleared' };
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
