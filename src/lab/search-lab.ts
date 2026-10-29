import type { CourseData } from "../course/course";
import { edges, playPlan, meter, type Plan } from "../sim/ideal";
import { DEFAULT_PARAMS } from "../sim/runner";
import { DT } from "../sim/units";

// Lab 1, Search (CC-118). The game finds its ideal run by searching: at each take-off edge it tries presses and keeps good ones.
// This module lets the player choose the search. A node is the list of presses made so far (one per edge); to judge it the REAL simulator plays
// the run and we look at where the runner lands after the last press. Same course and same choices give the same numbers (no clock, no randomness).
export type Method = "exhaustive" | "greedy" | "beam" | "astar";
export interface LabConfig {
  method: Method;
  beam: number; // beam width, 1 to 20 (greedy is a beam of 1)
  wDist: number; // heuristic weights, 0 to 1 each
  wSpeed: number;
  wHeight: number;
  budget: number; // most simulator runs ("steps") the search may spend
}
export const DEFAULT_CONFIG: LabConfig = { method: "greedy", beam: 5, wDist: 1, wSpeed: 0, wHeight: 0, budget: 3000 };

export interface LabResult {
  cleared: boolean;
  stuck: boolean; // ended without a clear: out of budget, or every branch fell
  budgetHit: boolean;
  steps: number; // simulator runs spent
  simSeconds: number; // seconds of game time those runs played, summed
  reach: number; // farthest take-off edge the best branch got past (0 to the number of edges)
  line: number[]; // the presses of the best line found (x in m)
  runSeconds: number | null; // seconds that line takes to finish, if it clears
  bestSeconds: number | null; // seconds of the stored plan (our line)
  gap: number | null; // runSeconds - bestSeconds
  edgeCount: number;
}

interface Node { presses: number[]; v: number; x: number; vx: number; y: number; tick: number; dead: boolean; cleared: boolean; seconds: number }

const PRESS_STEP = 0.25;
const PRESS_SPAN = 2.5;
export const clampCfg = (c: LabConfig): LabConfig => ({ ...c, beam: Math.max(1, Math.min(20, Math.round(c.beam))), budget: Math.max(1, Math.min(200000, Math.round(c.budget))), wDist: Math.max(0, Math.min(1, c.wDist)), wSpeed: Math.max(0, Math.min(1, c.wSpeed)), wHeight: Math.max(0, Math.min(1, c.wHeight)) });

export function planFor(presses: number[]): Plan { return { jumpXs: presses, releaseAfter: 60, bouncePress: 8 }; }

export function runLabSearch(course: CourseData, input: LabConfig, onStep?: (steps: number) => void): LabResult {
  const cfg = clampCfg(input);
  const es = edges(course);
  const n = es.length;
  const tops = course.terrain.platforms.map((p) => p.top);
  const lo = Math.min(...tops), hi = Math.max(...tops);
  const wSum = cfg.wDist + cfg.wSpeed + cfg.wHeight;
  const total = Math.max(1, course.finishX - course.startX);
  const heuristic = (x: number, vx: number, y: number): number => (wSum === 0 ? 0 : (cfg.wDist * (x - course.startX) / total + cfg.wSpeed * Math.min(1, Math.max(0, vx) / DEFAULT_PARAMS.topSpeed) + cfg.wHeight * (hi > lo ? (y - lo) / (hi - lo) : 0)) / wSum);
  const t0 = meter.ticks;
  let steps = 0;
  let budgetHit = false;
  let bestDepth = 0;
  const spend = (): boolean => { if (steps >= cfg.budget) { budgetHit = true; return false; } steps++; onStep?.(steps); return true; };

  // one simulator run for a list of presses; the node is where the runner landed after the last of them
  const play = (presses: number[]): Node => {
    const k = presses.length;
    let landed: { x: number; vx: number; y: number; tick: number } | null = null;
    const edgeX = es[k - 1].x;
    const r = playPlan(course, planFor(presses), 120 * 60, (w) => {
      if (!landed && w.mode === "run" && w.runner.grounded && w.runner.x > edgeX + 0.3) landed = { x: w.runner.x, vx: w.runner.vx, y: w.runner.y, tick: w.runner.tick };
    });
    const cleared = k === n && r.world.outcome === "cleared";
    const L = landed as { x: number; vx: number; y: number; tick: number } | null;
    if (!L) return { presses, v: 0, x: 0, vx: 0, y: 0, tick: 0, dead: true, cleared: false, seconds: 0 };
    if (k > bestDepth) bestDepth = k;
    return { presses, v: heuristic(L.x, L.vx, L.y), x: L.x, vx: L.vx, y: L.y, tick: L.tick, dead: k === n && !cleared, cleared, seconds: cleared ? r.world.runner.tick * DT : 0 };
  };

  // presses worth trying at edge k, from a node that landed at `from`
  const options = (k: number, from: number | null): number[] => {
    const e = es[k].x;
    const first = Math.max(from ?? course.startX, e - PRESS_SPAN);
    const out: number[] = [];
    for (let x = Math.ceil(first / PRESS_STEP) * PRESS_STEP; x <= e + 1e-9; x += PRESS_STEP) out.push(Math.round(x * 100) / 100);
    if (out.length === 0) out.push(Math.round(e * 100) / 100);
    return out;
  };
  const children = (parent: Node | null): Node[] => {
    const k = parent ? parent.presses.length : 0;
    const out: Node[] = [];
    for (const x of options(k, parent ? parent.x : null)) {
      if (!spend()) break;
      out.push(play([...(parent ? parent.presses : []), x]));
    }
    return out;
  };
  const rank = (a: Node, b: Node): number => b.v - a.v || a.presses[a.presses.length - 1] - b.presses[b.presses.length - 1];
  const fastest = (xs: Node[]): Node | null => xs.filter((x) => x.cleared).sort((a, b) => a.seconds - b.seconds || a.presses[0] - b.presses[0])[0] ?? null;

  let winner: Node | null = null;
  let deepest: Node | null = null;
  const note = (xs: Node[]) => { for (const x of xs) if (!x.dead || x.cleared) if (!deepest || x.presses.length > deepest.presses.length || (x.presses.length === deepest.presses.length && x.v > deepest.v)) deepest = x; };

  if (n === 0) { winner = null; }
  else if (cfg.method === "greedy" || cfg.method === "beam") {
    const width = cfg.method === "greedy" ? 1 : cfg.beam;
    let level: (Node | null)[] = [null];
    for (let k = 0; k < n && level.length; k++) {
      const next: Node[] = [];
      for (const p of level) next.push(...children(p));
      const live = next.filter((x) => !x.dead);
      note(live);
      if (k === n - 1) { winner = fastest(live); break; }
      level = live.sort(rank).slice(0, width);
      if (budgetHit) break;
    }
  } else if (cfg.method === "exhaustive") {
    const dfs = (p: Node | null): void => {
      const kids = children(p);
      const k = p ? p.presses.length : 0;
      note(kids.filter((x) => !x.dead));
      for (const c of kids) {
        if (c.dead) continue;
        if (k + 1 === n) { if (c.cleared && (!winner || c.seconds < winner.seconds)) winner = c; continue; }
        if (budgetHit) return;
        dfs(c);
      }
    };
    dfs(null);
  } else {
    // A*: the cost so far is the seconds of game time at the landing; the guess for the rest is the time the whole course would take at top speed, scaled by how much of the heuristic is still missing
    const h0 = total / DEFAULT_PARAMS.topSpeed;
    const f = (x: Node): number => (x.cleared ? x.seconds : x.tick * DT + h0 * (1 - x.v));
    const open: { node: Node; f: number; order: number }[] = [];
    let order = 0;
    const push = (xs: Node[]) => { for (const x of xs) if (!x.dead) open.push({ node: x, f: f(x), order: order++ }); };
    const first = children(null);
    note(first.filter((x) => !x.dead));
    push(first);
    while (open.length && !winner) {
      open.sort((a, b) => a.f - b.f || b.node.presses.length - a.node.presses.length || a.order - b.order);
      const top = open.shift()!;
      if (top.node.cleared) { winner = top.node; break; }
      if (budgetHit) break;
      const kids = children(top.node);
      note(kids.filter((x) => !x.dead));
      push(kids);
    }
  }

  const win = winner as Node | null;
  const line = win ? win.presses : (deepest as Node | null)?.presses ?? [];
  const best = course.plan ? playPlan(course, course.plan) : null;
  const bestSeconds = best && best.world.outcome === "cleared" ? best.world.runner.tick * DT : null;
  const runSeconds = win ? win.seconds : null;
  return {
    cleared: !!win,
    stuck: !win,
    budgetHit,
    steps,
    simSeconds: Math.round((meter.ticks - t0) * DT * 100) / 100,
    reach: win ? n : bestDepth,
    line,
    runSeconds,
    bestSeconds,
    gap: runSeconds != null && bestSeconds != null ? Math.round((runSeconds - bestSeconds) * 1000) / 1000 : null,
    edgeCount: n,
  };
}

// The path a line takes, for the picture: one point every few ticks.
export function pathOf(course: CourseData, plan: Plan, every = 3): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  let i = 0;
  playPlan(course, plan, 120 * 60, (w) => { if (i++ % every === 0) pts.push({ x: w.runner.x, y: w.runner.y }); });
  return pts;
}
