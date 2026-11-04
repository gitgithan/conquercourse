import type { CourseData } from "../../course/course";
import { playPlan, type Plan } from "../../sim/ideal";
import { TICKS_PER_SECOND } from "../../sim/units";

// Optimization. The game's drone and rope plans each have two settings that decide the finishing time.
// This module turns that into a surface: for every pair of settings, play the REAL simulator and read the time.
// Nothing here has a clock or a random source that is not seeded, so the same choices give the same numbers.
export interface Axis { key: string; label: string; unit: string; min: number; step: number; count: number }
export interface Problem {
  id: "rope" | "drone";
  title: string;
  settings: string; // the words for the card
  courseUrl: string;
  axes: [Axis, Axis]; // x axis (across the map), y axis (up the map)
  cap: number; // the most ticks a run may take
  planFor(x: number, y: number): Plan;
  start: [number, number]; // where a hill-climb starts unless the player picks a place (cell indexes)
}
export const FAIL_BASE = 1000; // a run that does not clear scores this plus the metres it still had to go: worse than every clear, but with a slope to follow

export const ROPE: Problem = {
  id: "rope", title: "Rope swing", settings: "When to jump, and when to let go of the rope",
  courseUrl: "/assets/lab/opt-rope.course.json",
  axes: [
    { key: "jump", label: "Jump press at x", unit: "m", min: 8, step: 0.25, count: 39 },
    { key: "release", label: "Let go after", unit: "ticks", min: 0, step: 5, count: 73 },
  ],
  cap: 2000,
  planFor: (x, y) => ({ jumpXs: [x], releaseAfter: y, bouncePress: 8 }),
  start: [12, 14],
};
export const DRONE: Problem = {
  id: "drone", title: "Drone ferry", settings: "Where to lean back (brake), and where to climb down",
  courseUrl: "/assets/demo/drone.course.json",
  axes: [
    { key: "brake", label: "Brake from x", unit: "m", min: 40, step: 0.5, count: 45 },
    { key: "descend", label: "Climb down from x", unit: "m", min: 48, step: 0.5, count: 37 },
  ],
  cap: 7200,
  planFor: (x, y) => ({ jumpXs: [], releaseAfter: 60, bouncePress: 8, droneBrakeX: x, droneDescendX: y }),
  start: [4, 4],
};
export const PROBLEMS: Problem[] = [ROPE, DRONE];

export const valueAt = (a: Axis, i: number): number => Math.round((a.min + a.step * i) * 1000) / 1000;

// One play of the real simulator at a cell. Cleared: the finishing time in seconds. Not cleared: FAIL_BASE plus the distance still to go.
export interface Sample { cleared: boolean; ticks: number; maxX: number; score: number }
export function sampleAt(p: Problem, course: CourseData, i: number, j: number): Sample {
  const r = playPlan(course, p.planFor(valueAt(p.axes[0], i), valueAt(p.axes[1], j)), p.cap);
  const cleared = r.world.outcome === "cleared";
  return { cleared, ticks: r.world.runner.tick, maxX: r.maxX, score: cleared ? r.world.runner.tick / TICKS_PER_SECOND : FAIL_BASE + Math.max(0, course.finishX - r.maxX) };
}

// The stored table: one number per cell, row by row (y then x). Positive: cleared, in ticks. Zero or less: not cleared, minus ten times the farthest x reached.
export interface Table { id: string; nx: number; ny: number; cells: number[] }
export const encode = (s: Sample): number => (s.cleared ? s.ticks : -Math.round(s.maxX * 10));
export function scoreFromCell(v: number, finishX: number): number { return v > 0 ? v / TICKS_PER_SECOND : FAIL_BASE + Math.max(0, finishX - -v / 10); }
export const tableScore = (t: Table, finishX: number) => (i: number, j: number): number => scoreFromCell(t.cells[j * t.nx + i], finishX);

// ---- the map's facts: local peaks (a cell faster than all eight neighbours) and the basin each one collects (where steepest descent ends there) ----
export interface Peak { i: number; j: number; score: number; basin: number; label: string }
const N8: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
export function bestNeighbour(f: (i: number, j: number) => number, nx: number, ny: number, i: number, j: number, here: number): { i: number; j: number; s: number } | null {
  let best: { i: number; j: number; s: number } | null = null;
  for (const [di, dj] of N8) {
    const a = i + di, b = j + dj;
    if (a < 0 || b < 0 || a >= nx || b >= ny) continue;
    const s = f(a, b);
    if (s < here - 1e-9 && (best === null || s < best.s - 1e-9)) best = { i: a, j: b, s };
  }
  return best;
}
// Peaks closer than MERGE cells are one peak (the tick count steps up and down a little along an edge, which makes tiny bumps), and a peak must collect at least `minBasin` cells to count.
export const MERGE = 6;
export function findPeaks(f: (i: number, j: number) => number, nx: number, ny: number, minBasin = 60): Peak[] {
  const basin = new Map<number, number>();
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let a = i, b = j, s = f(a, b);
    if (s >= FAIL_BASE) continue; // the cells that never clear are not part of any peak's slope
    for (;;) { const n = bestNeighbour(f, nx, ny, a, b, s); if (!n) break; a = n.i; b = n.j; s = n.s; }
    basin.set(b * nx + a, (basin.get(b * nx + a) ?? 0) + 1);
  }
  const raw = [...basin.entries()].map(([k, n]) => ({ i: k % nx, j: Math.floor(k / nx), score: f(k % nx, Math.floor(k / nx)), basin: n, label: "" }));
  raw.sort((p, q) => p.score - q.score || p.j - q.j || p.i - q.i);
  const kept: Peak[] = [];
  for (const p of raw) {
    const near = kept.find((k) => Math.max(Math.abs(k.i - p.i), Math.abs(k.j - p.j)) <= MERGE);
    if (near) near.basin += p.basin; else kept.push({ ...p });
  }
  const peaks = kept.filter((p) => p.basin >= minBasin);
  peaks.forEach((p, k) => (p.label = String.fromCharCode(65 + k)));
  return peaks;
}
// Which peak a stop belongs to: the nearest within MERGE cells, else null (a small bump).
export const peakOf = (peaks: Peak[], i: number, j: number): Peak | null => peaks.find((p) => Math.max(Math.abs(p.i - i), Math.abs(p.j - j)) <= MERGE) ?? null;

// ---- the three search methods. Each asks `ask(i, j)` for a score; the wrapper counts each different cell once (a simulator run) and stops at the budget. ----
export type Method = "grid" | "hill" | "random";
export interface Settings { grid: number; start: [number, number]; restarts: number; budget: number; seed: number }
export const DEFAULTS: Settings = { grid: 6, start: [0, 0], restarts: 8, budget: 400, seed: 7 };
export interface Trace { method: Method; path: { i: number; j: number }[]; stops: { i: number; j: number; score: number }[]; best: { i: number; j: number; score: number }; evals: number; budgetHit: boolean }

export function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

class Budget extends Error {}
function counted(raw: (i: number, j: number) => number, budget: number) {
  const seen = new Map<number, number>();
  let evals = 0;
  const ask = (i: number, j: number, nx: number): number => {
    const k = j * nx + i, hit = seen.get(k);
    if (hit !== undefined) return hit;
    if (evals >= budget) throw new Budget();
    evals++;
    const s = raw(i, j);
    seen.set(k, s);
    return s;
  };
  return { ask, evals: () => evals };
}

export function runMethod(method: Method, raw: (i: number, j: number) => number, nx: number, ny: number, cfg: Settings, onEval?: (n: number) => void): Trace {
  const c = counted((i, j) => { const s = raw(i, j); onEval?.(c.evals()); return s; }, Math.max(1, cfg.budget));
  const ask = (i: number, j: number) => c.ask(i, j, nx);
  const path: { i: number; j: number }[] = [];
  const stops: { i: number; j: number; score: number }[] = [];
  let best = { i: 0, j: 0, score: Infinity };
  const note = (i: number, j: number, s: number) => { if (s < best.score) best = { i, j, score: s }; };
  let budgetHit = false;
  let cur = { i: 0, j: 0, score: Infinity };
  const climb = (i0: number, j0: number) => {
    let i = i0, j = j0, s = ask(i, j);
    path.push({ i, j }); note(i, j, s); cur = { i, j, score: s };
    for (;;) {
      let nb: { i: number; j: number; s: number } | null = null;
      for (const [di, dj] of N8) {
        const a = i + di, b = j + dj;
        if (a < 0 || b < 0 || a >= nx || b >= ny) continue;
        const t = ask(a, b); note(a, b, t);
        if (t < s - 1e-9 && (nb === null || t < nb.s - 1e-9)) nb = { i: a, j: b, s: t };
      }
      if (!nb) break; // no neighbour is better: this is where it stops
      i = nb.i; j = nb.j; s = nb.s; path.push({ i, j }); cur = { i, j, score: s };
    }
    stops.push({ i, j, score: s });
  };
  try {
    if (method === "grid") {
      const g = Math.max(1, Math.round(cfg.grid));
      for (let j = 0; j < ny; j += g) for (let i = 0; i < nx; i += g) { const s = ask(i, j); path.push({ i, j }); note(i, j, s); }
    } else if (method === "hill") {
      climb(Math.min(nx - 1, Math.max(0, cfg.start[0])), Math.min(ny - 1, Math.max(0, cfg.start[1])));
    } else {
      const rnd = mulberry(cfg.seed);
      for (let r = 0; r < Math.max(1, cfg.restarts); r++) climb(Math.floor(rnd() * nx), Math.floor(rnd() * ny));
    }
  } catch (e) {
    if (!(e instanceof Budget)) throw e;
    budgetHit = true;
    if (method !== "grid" && path.length) stops.push({ ...cur }); // cut off where it stood
  }
  if (method === "grid") stops.push({ ...best });
  return { method, path, stops, best, evals: c.evals(), budgetHit };
}
