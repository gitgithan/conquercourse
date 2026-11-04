import type { BarRun } from '../sim/bars';
import { GAP_MAX, GAP_MIN } from '../sim/bars';
import type { Mesh } from './slice';

// Role-first collider (CC-133, docs/pipelines.md: "collision comes from a fitted primitive, never the mesh").
// A lifted photo object is noisy: holes, extra blobs, a squeezed depth, a guessed size, bars that are thin or fused.
// So the collider does not copy the shape. The role says what to measure (bar: height, span, one spacing; wall: height and width;
// pole: height and thickness; platform: height and size), the lift is cleaned first (the 3D cousin of the 2D opening and closing:
// voxelise, keep the largest connected piece, close the holes), and a clean primitive is built from those few numbers.
// The photo mesh is only the skin. Pure and deterministic: the same points always give the same numbers.

export type ColliderRole = 'bar' | 'wall' | 'pole' | 'platform';
export const BAR_HEIGHT_MIN = 1.8, BAR_HEIGHT_MAX = 4.5; // m, the rung heights the editor allows (src/modes/editor/tools/bars.ts)
export const RADIUS_MIN = 0.02, RADIUS_MAX = 0.045; // m, a rung a hand can close on
const GAP_DEFAULT = 0.6;

// ---- 3D clean-up -------------------------------------------------------------------------------------------------
export interface Grid { nx: number; ny: number; nz: number; size: number; ox: number; oy: number; oz: number; cells: Uint8Array }
const at = (g: Grid, x: number, y: number, z: number) => x + g.nx * (y + g.ny * z);

// The cells the surface touches: every triangle is split until its edges are shorter than a cell, so thin rungs are not missed.
export function voxelise(mesh: Mesh, size: number, pad = 2): Grid {
  const p = mesh.positions, n = p.length / 3;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[i * 3 + k]); hi[k] = Math.max(hi[k], p[i * 3 + k]); }
  if (!n) return { nx: 1, ny: 1, nz: 1, size, ox: 0, oy: 0, oz: 0, cells: new Uint8Array(1) };
  const g: Grid = { nx: Math.ceil((hi[0] - lo[0]) / size) + 1 + 2 * pad, ny: Math.ceil((hi[1] - lo[1]) / size) + 1 + 2 * pad, nz: Math.ceil((hi[2] - lo[2]) / size) + 1 + 2 * pad, size, ox: lo[0] - pad * size, oy: lo[1] - pad * size, oz: lo[2] - pad * size, cells: new Uint8Array(0) };
  g.cells = new Uint8Array(g.nx * g.ny * g.nz);
  const mark = (x: number, y: number, z: number) => { g.cells[at(g, Math.floor((x - g.ox) / size), Math.floor((y - g.oy) / size), Math.floor((z - g.oz) / size))] = 1; };
  const tri = (a: number[], b: number[], c: number[], depth: number) => {
    const d = (u: number[], v: number[]) => Math.hypot(u[0] - v[0], u[1] - v[1], u[2] - v[2]);
    if (depth > 12 || Math.max(d(a, b), d(b, c), d(c, a)) <= size * 0.7) { mark((a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3); mark(a[0], a[1], a[2]); mark(b[0], b[1], b[2]); mark(c[0], c[1], c[2]); return; }
    const m = (u: number[], v: number[]) => [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2, (u[2] + v[2]) / 2];
    const ab = m(a, b), bc = m(b, c), ca = m(c, a);
    tri(a, ab, ca, depth + 1); tri(ab, b, bc, depth + 1); tri(ca, bc, c, depth + 1); tri(ab, bc, ca, depth + 1);
  };
  const v = (i: number) => [p[i * 3], p[i * 3 + 1], p[i * 3 + 2]];
  if (mesh.indices && mesh.indices.length) for (let i = 0; i + 2 < mesh.indices.length; i += 3) tri(v(mesh.indices[i]), v(mesh.indices[i + 1]), v(mesh.indices[i + 2]), 0);
  else for (let i = 0; i < n; i++) mark(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
  return g;
}

export const count = (g: Grid): number => { let c = 0; for (let i = 0; i < g.cells.length; i++) c += g.cells[i]; return c; };

// Keep only the biggest piece (26 neighbours): the floating blobs and specks of a lift go.
export function largestComponent(g: Grid): { grid: Grid; pieces: number; dropped: number } {
  const label = new Int32Array(g.cells.length), sizes: number[] = [0];
  const stack: number[] = [];
  for (let s = 0; s < g.cells.length; s++) {
    if (!g.cells[s] || label[s]) continue;
    const id = sizes.length; let c = 0;
    label[s] = id; stack.push(s);
    while (stack.length) {
      const i = stack.pop()!; c++;
      const x = i % g.nx, y = Math.floor(i / g.nx) % g.ny, z = Math.floor(i / (g.nx * g.ny));
      for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = x + dx, Y = y + dy, Z = z + dz;
        if (X < 0 || Y < 0 || Z < 0 || X >= g.nx || Y >= g.ny || Z >= g.nz) continue;
        const j = at(g, X, Y, Z);
        if (g.cells[j] && !label[j]) { label[j] = id; stack.push(j); }
      }
    }
    sizes.push(c);
  }
  let best = 1;
  for (let k = 2; k < sizes.length; k++) if (sizes[k] > sizes[best]) best = k;
  const cells = new Uint8Array(g.cells.length);
  for (let i = 0; i < cells.length; i++) if (label[i] === best) cells[i] = 1;
  const total = sizes.reduce((a, b) => a + b, 0);
  return { grid: { ...g, cells }, pieces: sizes.length - 1, dropped: total - (sizes[best] ?? 0) };
}

// Dilate then erode (6 neighbours): small holes and cracks close, thin parts and the outer shape stay.
function morph(g: Grid, grow: boolean): Grid {
  const out = new Uint8Array(g.cells.length);
  for (let z = 0; z < g.nz; z++) for (let y = 0; y < g.ny; y++) for (let x = 0; x < g.nx; x++) {
    const nb = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    const on = (X: number, Y: number, Z: number) => X >= 0 && Y >= 0 && Z >= 0 && X < g.nx && Y < g.ny && Z < g.nz && g.cells[at(g, X, Y, Z)] === 1;
    let v: boolean;
    if (grow) v = on(x, y, z) || nb.some(([a, b, c]) => on(x + a, y + b, z + c));
    else v = on(x, y, z) && nb.every(([a, b, c]) => on(x + a, y + b, z + c));
    if (v) out[at(g, x, y, z)] = 1;
  }
  return { ...g, cells: out };
}
export const closing = (g: Grid, iters: number): Grid => { let r = g; for (let i = 0; i < iters; i++) r = morph(r, true); for (let i = 0; i < iters; i++) r = morph(r, false); return r; };

export interface CleanReport { voxels: number; pieces: number; blobCells: number; filledCells: number; kept: number }
export function cleanLift(mesh: Mesh, size = 0.05, closeIters = 1): { grid: Grid; report: CleanReport } {
  const raw = voxelise(mesh, size, closeIters + 2);
  const closed = closing(raw, closeIters); // holes and cracks first, so a frame that the holes cut in two is one piece again
  const { grid, pieces, dropped } = largestComponent(closed);
  const kept = count(grid);
  return { grid, report: { voxels: count(raw), pieces, blobCells: dropped, filledCells: Math.max(0, count(closed) - count(raw)), kept } };
}

// ---- measuring, by role ---------------------------------------------------------------------------------------------
export interface Extent { x: [number, number]; y: [number, number]; z: [number, number] } // metres, in the grid's own units
export function extentOf(g: Grid): Extent {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let z = 0; z < g.nz; z++) for (let y = 0; y < g.ny; y++) for (let x = 0; x < g.nx; x++) if (g.cells[at(g, x, y, z)]) {
    const c = [x, y, z]; for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], c[k]); hi[k] = Math.max(hi[k], c[k]); }
  }
  const o = [g.ox, g.oy, g.oz], f = (k: number): [number, number] => [o[k] + (lo[k] + 0.5) * g.size, o[k] + (hi[k] + 0.5) * g.size];
  return { x: f(0), y: f(1), z: f(2) };
}

const median = (a: number[]): number => { const s = [...a].sort((p, q) => p - q), m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : 0; };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r3 = (v: number) => Math.round(v * 1000) / 1000;

export interface BarsMeasure {
  axis: 'x' | 'z'; // the way the row runs
  height: number; span: number; // m: the rung centre above the lowest point of the object; the object's length along the axis
  rungs: number; gap: number; first: number; // n rungs, one spacing, the first rung's place along the axis from the object's middle
  radius: number;
  peaks: number[]; // the noisy rung places the spacing was fitted to (from the object's middle)
  gaps: number[]; // raw gaps between neighbouring peaks
  notes: string[];
}

// One spacing from noisy rung peaks: neighbouring gaps are rounded to a whole number of unit gaps (a missed rung gives a double gap, a split
// one a half gap), and the unit is the median. Rungs sit at first + i * gap; the first place is the median of the peaks' offsets.
export function regulariseRungs(peaks: number[]): { gap: number; first: number; n: number } {
  if (peaks.length < 2) return { gap: GAP_DEFAULT, first: peaks[0] ?? 0, n: peaks.length };
  const d = peaks.slice(1).map((v, i) => v - peaks[i]);
  const m0 = median(d);
  const gap0 = median(d.map((v) => v / Math.max(1, Math.round(v / m0))));
  // each peak gets its whole-number place on the row, then one line through them (least squares) gives the spacing and the first place
  const k = [0]; d.forEach((v) => k.push(k[k.length - 1] + Math.max(1, Math.round(v / gap0))));
  const mk = k.reduce((a, b) => a + b, 0) / k.length, mv = peaks.reduce((a, b) => a + b, 0) / peaks.length;
  let sxx = 0, sxy = 0;
  k.forEach((ki, i) => { sxx += (ki - mk) ** 2; sxy += (ki - mk) * (peaks[i] - mv); });
  const gap = sxx > 0 ? sxy / sxx : gap0, first = mv - gap * mk;
  const n0 = Math.max(...k) + 1;
  return { gap: Math.max(1e-6, gap), first, n: n0 };
}

// The top band, sliced along the long side: how many cells each slice holds, where the peaks are, which peaks are rungs. The Lab (src/labs/collision) draws these same numbers.
export interface BarProfile {
  axis: 'x' | 'z'; a0: number; a1: number; mid: number; top: number; band: number; bottom: number; // metres: the object's extent along the axis, the highest and the lowest cell
  cols: number; count: number[]; sm: number[]; base: number; max: number; thr: number; // cells per slice, the smoothed count, the median, the biggest, the peak line
  cand: number[]; kept: number[]; // slices that are peaks, and the ones left after "closer than a quarter metre is one rung" and the end-post rule
  peakU: number[]; // the rung places from the object's middle, in metres
  radii: number[]; tops: number[]; // per kept rung: the radius its thickness gives, the highest cell
  notes: string[];
}
export function barProfile(g: Grid, opts: { band?: number } = {}): BarProfile {
  const e = extentOf(g), notes: string[] = [];
  const ax: 'x' | 'z' = e.x[1] - e.x[0] >= e.z[1] - e.z[0] ? 'x' : 'z';
  const [a0, a1] = e[ax], mid = (a0 + a1) / 2, top = e.y[1], band = opts.band ?? 0.3;
  const cols = Math.round((a1 - a0) / g.size) + 1, count = new Float64Array(cols), topY = new Float64Array(cols).fill(-Infinity), layers: Set<number>[] = Array.from({ length: cols }, () => new Set<number>());
  for (let z = 0; z < g.nz; z++) for (let y = 0; y < g.ny; y++) for (let x = 0; x < g.nx; x++) {
    if (!g.cells[at(g, x, y, z)]) continue;
    const yc = g.oy + (y + 0.5) * g.size;
    if (yc < top - band) continue;
    const u = ax === 'x' ? g.ox + (x + 0.5) * g.size : g.oz + (z + 0.5) * g.size, c = clamp(Math.floor((u - a0) / g.size), 0, cols - 1);
    count[c]++; layers[c].add(y); topY[c] = Math.max(topY[c], yc + g.size / 2);
  }
  const sm = Array.from(count, (_, i) => (count[Math.max(0, i - 1)] + 2 * count[i] + count[Math.min(cols - 1, i + 1)]) / 4);
  const base = median(sm), mx = Math.max(...sm), thr = base + 0.4 * (mx - base);
  const cand: number[] = [];
  for (let i = 0; i < cols; i++) if (sm[i] >= thr && sm[i] >= (sm[i - 1] ?? -1) && sm[i] > (sm[i + 1] ?? -1)) cand.push(i);
  // peaks closer than a quarter metre are one rung: keep the stronger
  const minSep = 0.25 / g.size, kept: number[] = [];
  for (const i of cand) { const last = kept[kept.length - 1]; if (last !== undefined && i - last < minSep) { if (sm[i] > sm[last]) kept[kept.length - 1] = i; } else kept.push(i); }
  // the thickness of a column's top: the run of filled layers down from its highest cell (a rung is a few layers, a post or a leg is many)
  const runOf = (i: number): number => { let y = Math.max(...layers[i], -1), c = 0; while (y >= 0 && layers[i].has(y)) { c++; y--; } return c; };
  for (let again = 0; again < 2; again++) for (const end of [0, kept.length - 1]) {
    if (kept.length < 4) break;
    const rest = kept.filter((_, k) => k !== 0 && k !== kept.length - 1).map(runOf), typical = median(rest);
    if (runOf(kept[end]) >= Math.max(4, 2 * typical)) { kept.splice(end, 1); notes.push('an end post was not counted as a rung'); break; }
  }
  return { axis: ax, a0, a1, mid, top, band, bottom: e.y[0], cols, count: Array.from(count), sm, base, max: mx, thr, cand, kept, peakU: kept.map((i) => a0 + (i + 0.5) * g.size - mid), radii: kept.map((i) => (runOf(i) * g.size) / 2), tops: kept.map((i) => topY[i]), notes };
}

// From the rung places to the row the game keeps: one spacing, held inside what the editor allows (GAP_MIN, GAP_MAX in src/sim/bars.ts).
export interface FittedRow { gap: number; first: number; n: number; fitGap: number; stride: number; notes: string[] } // fitGap: the spacing before the clamps; stride: every k-th rung is used when it was under GAP_MIN
export function fitRow(peakU: number[], span: number): FittedRow {
  const reg = regulariseRungs(peakU), notes: string[] = [];
  let { gap, n } = reg, stride = 1;
  const fitGap = gap;
  if (gap < GAP_MIN - 1e-6) { const k = Math.ceil(GAP_MIN / gap - 1e-6); stride = k; notes.push(`measured spacing ${r3(gap)} m is under ${GAP_MIN} m: every ${k}th rung is used`); gap *= k; n = Math.floor((n - 1) / k) + 1; }
  if (gap > GAP_MAX) { notes.push(`measured spacing ${r3(gap)} m is over ${GAP_MAX} m: it is held at ${GAP_MAX} m`); gap = GAP_MAX; }
  if (n < 2) { notes.push('fewer than two rungs found: two rungs at the default spacing across the span'); gap = GAP_DEFAULT; n = Math.max(2, Math.round(span / gap)); }
  return { gap, first: reg.first, n, fitGap, stride, notes };
}

export function measureBars(g: Grid, opts: { band?: number } = {}): BarsMeasure {
  const pr = barProfile(g, opts), notes = [...pr.notes];
  const fit = fitRow(pr.peakU, pr.a1 - pr.a0);
  notes.push(...fit.notes);
  const raw = pr.peakU.slice(1).map((v, i) => r3(v - pr.peakU[i]));
  const radius = clamp(median(pr.radii), RADIUS_MIN, RADIUS_MAX);
  const centreTop = median(pr.tops.filter(Number.isFinite)) || pr.top;
  const measuredHeight = centreTop - radius - pr.bottom;
  let height = measuredHeight;
  if (height < BAR_HEIGHT_MIN || height > BAR_HEIGHT_MAX) { height = clamp(height, BAR_HEIGHT_MIN, BAR_HEIGHT_MAX); notes.push(`rung height ${r3(measuredHeight)} m is outside what the hands can swing from: it is held at ${r3(height)} m`); }
  return { axis: pr.axis, height: r3(height), span: r3(pr.a1 - pr.a0), rungs: fit.n, gap: r3(fit.gap), first: r3(fit.first), radius: r3(radius), peaks: pr.peakU.map(r3), gaps: raw, notes };
}

export interface WallMeasure { height: number; width: number; depth: number }
export function measureWall(g: Grid): WallMeasure { const e = extentOf(g); return { height: r3(e.y[1] - e.y[0]), width: r3(Math.max(e.x[1] - e.x[0], e.z[1] - e.z[0])), depth: r3(Math.min(e.x[1] - e.x[0], e.z[1] - e.z[0])) }; }

export interface PoleMeasure { height: number; thickness: number }
// Thickness is read at the middle of the height (the foot and the top of a lifted pole are the noisy parts): the widest side of the cells there.
export function measurePole(g: Grid): PoleMeasure {
  const e = extentOf(g), ym = (e.y[0] + e.y[1]) / 2, row = Math.min(g.ny - 1, Math.max(0, Math.floor((ym - g.oy) / g.size)));
  const widths: number[] = [];
  for (let y = Math.max(0, row - 2); y <= Math.min(g.ny - 1, row + 2); y++) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let z = 0; z < g.nz; z++) for (let x = 0; x < g.nx; x++) if (g.cells[at(g, x, y, z)]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    if (x1 >= x0) widths.push(Math.max(x1 - x0, z1 - z0) + 1);
  }
  return { height: r3(e.y[1] - e.y[0]), thickness: r3(median(widths) * g.size) };
}

// ---- the collider ------------------------------------------------------------------------------------------------------
// The same shape the fit step uses (src/park/fit.ts Primitive), re-declared here so this file needs nothing from the park code.
export interface RolePrimitive {
  type: 'platform' | 'wall' | 'bar'; kind: string; roles: ('stand' | 'grab' | 'vault')[];
  height: number; length: number; width?: number; thickness?: number;
  scale: { source: 'maker' | 'typical-size'; uncertainty: number; reference?: string };
}
export interface RoleCollider {
  role: ColliderRole;
  primitive: RolePrimitive;
  bars?: BarsMeasure & { run: BarRun }; // the monkey-bar row, x counted from the object's middle along its axis
  scaleUsed: number; // how much the lift was resized to the known height (1 = not at all)
  clean: CleanReport;
  notes: string[];
}
export interface RoleOpts { knownHeight?: number; voxel?: number; closeIters?: number }

// mesh + role + known size -> clean numbers and a primitive. `knownHeight` is the real height of the whole object (typed by the maker): a lift's own size is a guess.
export function roleCollider(mesh: Mesh, role: ColliderRole, opts: RoleOpts = {}): RoleCollider {
  const size = opts.voxel ?? 0.05, notes: string[] = [];
  // the scale is fixed before voxelising, so the cell size means real metres
  const p = mesh.positions; let ylo = Infinity, yhi = -Infinity;
  for (let i = 1; i < p.length; i += 3) { ylo = Math.min(ylo, p[i]); yhi = Math.max(yhi, p[i]); }
  const k = opts.knownHeight && yhi > ylo ? opts.knownHeight / (yhi - ylo) : 1;
  const scaled: Mesh = k === 1 ? mesh : { positions: Array.from(p, (v) => v * k), indices: mesh.indices };
  const { grid, report } = cleanLift(scaled, size, opts.closeIters ?? 1);
  const sc = { source: opts.knownHeight ? 'maker' as const : 'typical-size' as const, uncertainty: opts.knownHeight ? 0.1 : 0.35, reference: opts.knownHeight ? 'the height typed by the maker' : undefined };
  const e = extentOf(grid);
  if (role === 'bar') {
    const b = measureBars(grid);
    const run: BarRun = { x: r3(b.first), y: b.height, n: b.rungs, gap: b.gap };
    return { role, primitive: { type: 'bar', kind: 'rail', roles: ['grab'], height: b.height, length: r3((b.rungs - 1) * b.gap), thickness: b.radius * 2, scale: sc }, bars: { ...b, run }, scaleUsed: k, clean: report, notes: [...notes, ...b.notes] };
  }
  if (role === 'wall') { const w = measureWall(grid); return { role, primitive: { type: 'wall', kind: 'wall', roles: ['vault', 'grab'], height: w.height, length: w.width, width: w.width, thickness: w.depth, scale: sc }, scaleUsed: k, clean: report, notes }; }
  if (role === 'pole') { const w = measurePole(grid); return { role, primitive: { type: 'wall', kind: 'pole', roles: ['grab'], height: w.height, length: w.thickness, thickness: w.thickness, scale: sc }, scaleUsed: k, clean: report, notes }; }
  const w = measureWall(grid);
  void e;
  return { role, primitive: { type: 'platform', kind: 'platform', roles: ['stand'], height: w.height, length: w.width, width: w.depth, scale: sc }, scaleUsed: k, clean: report, notes };
}

// The feature switch (new feature: off in production). ?rolecollider=1 turns it on anywhere, =0 off anywhere;
// with no word it is on for the laptop and the preview site and off on the real site.
export function roleColliderOn(params: URLSearchParams, host: string): boolean {
  const w = params.get('rolecollider');
  if (w === '1') return true;
  if (w === '0') return false;
  return host === 'localhost' || host === '127.0.0.1' || host.startsWith('preview.') || host.includes('.preview.');
}
