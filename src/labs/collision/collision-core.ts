import type { CourseData } from '../../course/course';
import { GAP_MAX, GAP_MIN, type BarRun } from '../../sim/bars';
import type { InputLog } from '../../sim/replay';
import { verifyLog } from '../../sim/replay';
import type { Mesh } from '../../slice/slice';
import { barProfile, closing, count, fitRow, largestComponent, measureBars, regulariseRungs, voxelise, type BarProfile, type BarsMeasure, type FittedRow, type Grid } from '../../slice/role-collider';

// Lab 13 (pipeline stage 4: collision from a 3D lift). Every number here comes from the game's own src/slice/role-collider.ts, one step at a time,
// in the order cleanLift and measureBars run them. Pure and deterministic; no DOM, so the tests and the page run the same code.
export const GLB_URL = '/assets/objects/monkey-bars-saienji-cc0.glb';
export const KNOWN_HEIGHT = 2.2; // m, the maker's typed height of the whole frame (scripts/make-bars-lift-demo.ts)
export const DEFAULT_VOXEL = 0.05, CLOSE_ITERS = 1;
export const FIRST_RUNG_X = 12; // where the first rung stands along the demo course, as in the demo script
export const DEMO_COURSE_URL = '/assets/demo/bars-lift.course.json', DEMO_RUN_URL = '/assets/demo/bars-lift.run.json';
const r3 = (v: number) => Math.round(v * 1000) / 1000;

// ---- the steps ----------------------------------------------------------------------------------------------------
export interface Side { w: number; h: number; ox: number; oy: number; size: number; cells: Uint8Array } // a side-on shadow of a grid: x is the way the row runs, y is up
export function sideView(g: Grid, axis: 'x' | 'z'): Side {
  const w = axis === 'x' ? g.nx : g.nz, h = g.ny, cells = new Uint8Array(w * h);
  for (let z = 0; z < g.nz; z++) for (let y = 0; y < g.ny; y++) for (let x = 0; x < g.nx; x++) if (g.cells[x + g.nx * (y + g.ny * z)]) cells[(axis === 'x' ? x : z) + w * y] = 1;
  return { w, h, ox: axis === 'x' ? g.ox : g.oz, oy: g.oy, size: g.size, cells };
}

export function scaleMesh(mesh: Mesh, knownHeight: number): { mesh: Mesh; k: number } {
  const p = mesh.positions; let lo = Infinity, hi = -Infinity;
  for (let i = 1; i < p.length; i += 3) { lo = Math.min(lo, p[i]); hi = Math.max(hi, p[i]); }
  const k = knownHeight && hi > lo ? knownHeight / (hi - lo) : 1; // the same rule as roleCollider
  return { mesh: k === 1 ? mesh : { positions: Array.from(p, (v) => v * k), indices: mesh.indices }, k };
}

export interface Stages {
  voxel: number; scale: number; scaled: Mesh;
  raw: Grid; closed: Grid; kept: Grid; // voxelised, after closing holes, after keeping the biggest piece
  counts: { raw: number; closed: number; kept: number; filled: number; pieces: number; dropped: number };
  profile: BarProfile; measure: BarsMeasure; // the top band sliced along the row, and the numbers the role keeps
  side: { raw: Side; closed: Side; kept: Side };
  run: BarRun; // what the game would keep: {x, y, n, gap}
}
export function runStages(mesh: Mesh, o: { voxel?: number; knownHeight?: number; closeIters?: number } = {}): Stages {
  const voxel = o.voxel ?? DEFAULT_VOXEL, iters = o.closeIters ?? CLOSE_ITERS;
  const { mesh: scaled, k } = scaleMesh(mesh, o.knownHeight ?? KNOWN_HEIGHT);
  const raw = voxelise(scaled, voxel, iters + 2);
  const closed = closing(raw, iters); // holes first, so a frame the holes cut in two is one piece again (cleanLift's order)
  const lc = largestComponent(closed);
  const profile = barProfile(lc.grid), measure = measureBars(lc.grid);
  const axis = profile.axis;
  return {
    voxel, scale: k, scaled, raw, closed, kept: lc.grid,
    counts: { raw: count(raw), closed: count(closed), kept: count(lc.grid), filled: Math.max(0, count(closed) - count(raw)), pieces: lc.pieces, dropped: lc.dropped },
    profile, measure, side: { raw: sideView(raw, axis), closed: sideView(closed, axis), kept: sideView(lc.grid, axis) },
    run: { x: r3(measure.first), y: measure.height, n: measure.rungs, gap: measure.gap },
  };
}

// ---- regularise: the gaps, rounded -----------------------------------------------------------------------------------
export interface GapRow { raw: number; units: number; unit: number } // a raw gap, how many unit gaps it holds (1 = one rung step, 2 = a missed rung, ...), the unit
export function gapTable(peaks: number[]): GapRow[] {
  if (peaks.length < 2) return [];
  const d = peaks.slice(1).map((v, i) => v - peaks[i]);
  const med = (a: number[]) => { const s = [...a].sort((p, q) => p - q), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const m0 = med(d), unit = med(d.map((v) => v / Math.max(1, Math.round(v / m0))));
  return d.map((v) => ({ raw: r3(v), units: Math.max(1, Math.round(v / unit)), unit: r3(unit) })); // the same rounding regulariseRungs uses
}

// ---- break it ---------------------------------------------------------------------------------------------------------
export type BreakKind = 'none' | 'noise' | 'missed' | 'split' | 'fused';
export interface Break { kind: BreakKind; index: number; sigma: number; seed: number } // index: which rung; sigma: metres of wobble
export const BREAKS: { kind: BreakKind; name: string; says: string }[] = [
  { kind: 'none', name: 'Nothing broken', says: 'The peaks as the lift gave them.' },
  { kind: 'noise', name: 'Wobble every rung', says: 'Every rung place moves a little, as a noisy lift does.' },
  { kind: 'missed', name: 'A rung is missed', says: 'One rung leaves no peak: its neighbours are a double gap apart.' },
  { kind: 'split', name: 'A rung is split in two', says: 'One extra peak sits half way between two rungs: two half gaps.' },
  { kind: 'fused', name: 'Two rungs are fused', says: 'Two neighbouring rungs make one peak in the middle.' },
];
export const DEFAULT_BREAK: Break = { kind: 'missed', index: 3, sigma: 0.04, seed: 7 };
function rng(seed: number): () => number { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function breakPeaks(peaks: number[], b: Break): number[] {
  const p = [...peaks], i = Math.max(0, Math.min(p.length - 2, b.index));
  if (b.kind === 'noise') { const r = rng(b.seed); return p.map((v) => v + (r() * 2 - 1) * b.sigma).sort((x, y) => x - y); }
  if (p.length < 4) return p;
  if (b.kind === 'missed') { p.splice(i, 1); return p; }
  if (b.kind === 'split') { p.splice(i + 1, 0, (p[i] + p[i + 1]) / 2); return p; }
  if (b.kind === 'fused') { p.splice(i, 2, (p[i] + p[i + 1]) / 2); return p; }
  return p;
}

export interface Compare {
  peaks: number[]; // after the break
  fit: FittedRow; run: BarRun;
  copied: { rungs: number; gaps: number[]; gapMin: number; gapMax: number; gapStd: number; outsideEditor: number; worstPlace: number }; // a collider that copies the peaks
  fitted: { rungs: number; gap: number; gapStd: number; outsideEditor: number; worstPlace: number };
  sameAsGame: boolean; // the fitted row equals the unbroken row
}
const std = (a: number[]) => { if (a.length < 2) return 0; const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length); };
const worst = (places: number[], truth: number[]) => truth.length ? Math.max(...truth.map((t) => Math.min(...places.map((p) => Math.abs(p - t))))) : 0;
const rowPlaces = (first: number, gap: number, n: number) => Array.from({ length: n }, (_, i) => first + i * gap);
// The unbroken row is the truth; a broken lift is judged by how far each true rung is from the nearest rung the collider holds.
export function compareBreak(st: Stages, b: Break): Compare {
  const base = fitRow(st.profile.peakU, st.profile.a1 - st.profile.a0), truth = rowPlaces(base.first, base.gap, base.n);
  const peaks = breakPeaks(st.profile.peakU, b), fit = fitRow(peaks, st.profile.a1 - st.profile.a0);
  const gaps = peaks.slice(1).map((v, i) => r3(v - peaks[i]));
  const fitted = rowPlaces(fit.first, fit.gap, fit.n);
  const out = (a: number[]) => a.filter((g) => g < GAP_MIN - 1e-6 || g > GAP_MAX + 1e-6).length;
  return {
    peaks, fit, run: { x: r3(fit.first), y: st.measure.height, n: fit.n, gap: r3(fit.gap) },
    copied: { rungs: peaks.length, gaps, gapMin: gaps.length ? Math.min(...gaps) : 0, gapMax: gaps.length ? Math.max(...gaps) : 0, gapStd: r3(std(gaps)), outsideEditor: out(gaps), worstPlace: r3(worst(peaks, truth)) },
    fitted: { rungs: fit.n, gap: r3(fit.gap), gapStd: 0, outsideEditor: out([fit.gap]), worstPlace: r3(worst(fitted, truth)) },
    sameAsGame: fit.n === base.n && Math.abs(fit.gap - base.gap) < 0.01,
  };
}

// ---- the simulator card -------------------------------------------------------------------------------------------------
// The demo course's shape (scripts/make-bars-lift-demo.ts) around any row: first rung at FIRST_RUNG_X, the platforms either side.
export function courseFor(row: BarRun): CourseData {
  const lastX = FIRST_RUNG_X + (row.n - 1) * row.gap;
  return { version: 1, name: 'Monkey bars from a photo: the collider is measured, the photo is the skin', startX: 0, finishX: Math.round(lastX + 8), jumpSpeed: 4.5, terrain: { waterY: -6, platforms: [{ x0: -10, x1: 9, top: 0 }, { x0: Math.round(lastX + 4), x1: Math.round(lastX + 26), top: 0 }] }, grabReach: 0.4, bars: [{ x: FIRST_RUNG_X, y: row.y, n: row.n, gap: row.gap }] };
}
export interface Played { cleared: boolean; ticks: number; xs: number[]; ys: number[] }
export function playKeys(course: CourseData, log: InputLog): Played {
  const v = verifyLog(course, log);
  return { cleared: v.cleared, ticks: v.ticks, xs: Array.from(v.track.xs), ys: Array.from(v.track.ys) };
}

export { GAP_MAX, GAP_MIN, regulariseRungs };
