import { GAP_MAX, GAP_MIN } from '../sim/bars';
import type { BarRun } from '../sim/bars';
import { HALF_LANE } from './slice';
import type { Mesh } from './slice';
import { centred, newPiece, realSize, type Piece } from './world';
import { roleCollider } from './role-collider';

// Monkey bars in the editor (docs/bars.md): a piece whose src is "bars:<rungs>:<gap>" is a row of rungs overhead. The knobs live in the src,
// so saving, copying and undo need no extra fields. It is not ground (noGround); in the course it becomes a row { x, y, n, gap }.
// The piece's own height off the ground (y) is the rung height.
export type P = Piece & { src?: string };
export const BARS_PREFIX = 'bars:';
export interface BarsSpec { n: number; gap: number }
export const DEFAULT_BARS_SPEC: BarsSpec = { n: 6, gap: 0.6 };
export const RUNGS_MIN = 2, RUNGS_MAX = 40;
export const RUNG_THICK = 0.06, RUNG_DEPTH = 0.8; // m: the drawn rung (the hands hold at its middle height)

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const r3 = (v: number) => Math.round(v * 1000) / 1000;

export const barsSrc = (s: BarsSpec): string => `${BARS_PREFIX}${s.n}:${s.gap}`;
export function barsSpecOf(src: string | undefined): BarsSpec | undefined {
  if (!src?.startsWith(BARS_PREFIX)) return undefined;
  const [n, gap] = src.slice(BARS_PREFIX.length).split(':');
  const num = (v: string | undefined, d: number) => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
  return { n: Math.round(clamp(num(n, DEFAULT_BARS_SPEC.n), RUNGS_MIN, RUNGS_MAX)), gap: clamp(num(gap, DEFAULT_BARS_SPEC.gap), GAP_MIN, GAP_MAX) };
}
export const isBarsPiece = (p: { src?: string }): boolean => !!barsSpecOf(p.src);

// n thin rungs, one every `gap` metres along x, each RUNG_DEPTH across the lane.
export function barsMesh(s: BarsSpec): Mesh {
  const positions: number[] = [], indices: number[] = [];
  const q = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2];
  for (let i = 0; i < s.n; i++) {
    const cx = i * s.gap, [x0, x1, y0, y1, z0, z1] = [cx - 0.02, cx + 0.02, 0, RUNG_THICK, -RUNG_DEPTH / 2, RUNG_DEPTH / 2];
    const base = positions.length / 3;
    positions.push(x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1);
    for (const k of q) indices.push(base + k);
  }
  return { positions, indices };
}

export function barsPiece(spec: BarsSpec, at: { x: number; z: number }, y = 2.6): P {
  const p: P = { ...newPiece('Monkey bars', centred(barsMesh(spec)), at), src: barsSrc(spec), y };
  p.noGround = true;
  return p;
}

// Change the knobs in place (mesh and src follow; the middle of the row stays where it is).
export function setBars(p: P, spec: BarsSpec): void {
  const s = { n: Math.round(clamp(spec.n, RUNGS_MIN, RUNGS_MAX)), gap: clamp(spec.gap, GAP_MIN, GAP_MAX) };
  p.src = barsSrc(s);
  p.mesh = centred(barsMesh(s));
  p.name = 'Monkey bars';
  p.noGround = true;
}

// 'Fit to selected': the row that lies along the top of an object (a lifted photo object, a box): along its longer side, at its top height,
// with as many rungs as fit at the default spacing (the spacing stretches inside its limits to cover the whole length).
export function fitBarsTo(obj: P, roleFirst = false): { spec: BarsSpec; x: number; z: number; y: number; yaw: number } {
  if (roleFirst) { const f = fitBarsByRole(obj); if (f) return f; } // behind ?rolecollider: measured bars from the cleaned lift; off, the old shape-box fit below is unchanged
  const r = realSize(obj);
  const long = Math.max(r.w, r.d), turned = r.d > r.w;
  const n = Math.round(clamp(Math.round(long / DEFAULT_BARS_SPEC.gap) + 1, RUNGS_MIN, RUNGS_MAX));
  const gap = clamp(Math.round((long / (n - 1)) * 20) / 20, GAP_MIN, GAP_MAX);
  return { spec: { n, gap }, x: obj.x, z: obj.z, y: r3(obj.y + r.h), yaw: obj.yaw + (turned ? Math.PI / 2 : 0) };
}

// Role first (CC-133, src/slice/role-collider.ts): the object is a bar frame, so clean the lift and measure only height, span and one spacing.
// The row lies where the measured rungs are (not the middle of the box), at the measured rung height, with the measured spacing.
export function fitBarsByRole(obj: P): { spec: BarsSpec; x: number; z: number; y: number; yaw: number } | null {
  const r = realSize(obj);
  if (!(r.h > 0.3) || !obj.mesh.positions.length) return null;
  const c = roleCollider(obj.mesh, 'bar', { knownHeight: r.h });
  const b = c.bars;
  if (!b || b.rungs < RUNGS_MIN) return null;
  const n = Math.min(RUNGS_MAX, b.rungs), gap = clamp(b.gap, GAP_MIN, GAP_MAX);
  const mid = b.first + ((n - 1) * gap) / 2; // from the object's middle along its long axis to the middle of the row
  const turned = b.axis === 'z', yaw = obj.yaw + (turned ? Math.PI / 2 : 0);
  const k = Math.cos(obj.yaw + (turned ? Math.PI / 2 : 0)), l = Math.sin(obj.yaw + (turned ? Math.PI / 2 : 0));
  return { spec: { n, gap }, x: r3(obj.x + mid * k), z: r3(obj.z + mid * l), y: r3(obj.y + b.height - RUNG_THICK / 2), yaw };
}
export function fitBars(p: P, obj: P, roleFirst = false): void {
  const f = fitBarsTo(obj, roleFirst);
  setBars(p, f.spec);
  p.x = f.x; p.z = f.z; p.y = f.y; p.yaw = f.yaw;
}

// The rows that lie along the lane: u of the first rung, the rung height above the lane's level, the rungs and the spacing. A row turned across the lane is ignored.
export function barsOf(pieces: P[], lane: { angle: number; offset: number; level: number }): { u0: number; y: number; n: number; gap: number; id: number }[] {
  const c = Math.cos(lane.angle), s = Math.sin(lane.angle);
  const out: { u0: number; y: number; n: number; gap: number; id: number }[] = [];
  for (const p of pieces) {
    const spec = barsSpecOf(p.src);
    if (!spec) continue;
    const along = Math.cos(p.yaw - lane.angle);
    if (Math.abs(along) < 0.7) continue;
    const u = p.x * c + p.z * s, v = -p.x * s + p.z * c - lane.offset;
    const y = p.y + RUNG_THICK / 2 - lane.level;
    if (Math.abs(v) > HALF_LANE + 0.5 || y <= 0.3) continue;
    const gap = clamp(spec.gap * p.scale, GAP_MIN, GAP_MAX), half = ((spec.n - 1) * gap) / 2;
    out.push({ u0: u - half, y, n: spec.n, gap, id: p.id });
  }
  return out.sort((a, b) => a.u0 - b.u0);
}

// The rows in the shape the course takes (x is filled in by the caller, who knows where the ground went).
export const toBarRuns = (rows: ReturnType<typeof barsOf>, xOf: (u: number) => number): BarRun[] => rows.map((b) => ({ x: Math.round(xOf(b.u0) * 100) / 100, y: Math.round(b.y * 100) / 100, n: b.n, gap: Math.round(b.gap * 100) / 100 }));

// 'Pull-up bar to monkey bars': a row whose first rung is `ahead` metres past a swing bar (the bar's own place and height), so a release from the bar
// near the first rung and E again takes the rung (tests/bars.test.ts, "from a bar to the monkey bars"). The row is as high as the bar.
export const BAR_TO_BARS_AHEAD = 2.4; // m from the bar to the first rung
export function barsAfterBar(bar: P, spec: BarsSpec = DEFAULT_BARS_SPEC): P {
  const half = ((spec.n - 1) * spec.gap) / 2, c = Math.cos(bar.yaw), s = Math.sin(bar.yaw);
  const q = barsPiece(spec, { x: bar.x + (BAR_TO_BARS_AHEAD + half) * c, z: bar.z + (BAR_TO_BARS_AHEAD + half) * s });
  q.y = Math.round((bar.y + 0.04 - RUNG_THICK / 2) * 1000) / 1000; // hands on the bar and on the rungs at one height
  q.yaw = bar.yaw;
  return q;
}
