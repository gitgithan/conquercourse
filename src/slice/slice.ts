import type { CourseData } from '../course/course';
import type { Platform } from '../sim/terrain';
import { searchIdealRun } from '../sim/ideal';

// Cutting a 2 m lane out of a 3D scene to make a course (docs/world-slice.md).
// A scene is turned about a vertical rod through its middle; each turn, each sideways step and each height level gives
// a different lane. The lane's top outline becomes the ground; the search keeps the lane with the most interesting shapes.
// Pure maths on points: no page, no scene graph. y is up.

export interface Mesh { positions: ArrayLike<number>; indices?: ArrayLike<number> } // xyz triples; triangles if indices are given

export const BAND = 4.3; // m of height above the slice level the moves can handle (the Warped Wall's height)
export const HALF_LANE = 1; // m each side of the lane's middle
export const CELL = 0.1; // m along the run

// Points all over the surface of the mesh, about `perM2` per square metre (a mesh without triangles is its own points).
export function surfaceSamples(mesh: Mesh, perM2 = 600): Float32Array {
  const p = mesh.positions, idx = mesh.indices;
  if (!idx) return Float32Array.from(p as ArrayLike<number>);
  const out: number[] = [];
  let seed = 12345;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (let t = 0; t + 2 < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const area = 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
    const n = Math.max(1, Math.ceil(area * perM2));
    for (let i = 0; i < n; i++) {
      let r = rnd(), s = rnd();
      if (r + s > 1) { r = 1 - r; s = 1 - s; }
      out.push(p[a] + r * ux + s * vx, p[a + 1] + r * uy + s * vy, p[a + 2] + r * uz + s * vz);
    }
  }
  return Float32Array.from(out);
}

export interface SliceOptions { angle: number; offset: number; level: number } // radians about the vertical rod, metres sideways, metres up

export interface Profile { cells: (number | null)[]; length: number } // height above the level per 0.1 m along the run, null where there is no ground

export function sliceProfile(samples: Float32Array, centre: { x: number; z: number }, o: SliceOptions): Profile {
  const dx = Math.cos(o.angle), dz = Math.sin(o.angle), nx = -dz, nz = dx;
  const tops = new Map<number, number>();
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < samples.length; i += 3) {
    const x = samples[i] - centre.x, z = samples[i + 2] - centre.z, y = samples[i + 1] - o.level;
    if (Math.abs(x * nx + z * nz - o.offset) > HALF_LANE || y < 0) continue; // outside the lane, or below the level (water)
    const u = Math.floor((x * dx + z * dz) / CELL);
    lo = Math.min(lo, u); hi = Math.max(hi, u);
    const h = Math.min(y, BAND);
    if (h > (tops.get(u) ?? -1)) tops.set(u, h);
  }
  if (lo > hi) return { cells: [], length: 0 };
  const cells: (number | null)[] = [];
  for (let u = lo; u <= hi; u++) cells.push(tops.get(u) ?? null);
  return { cells, length: cells.length * CELL };
}

// What a lane contains, and how interesting it is for a runner.
export interface SliceReport { gaps: number; steps: number; curves: number; faces: number; length: number; variety: number; maxRise: number; score: number }

export const JUMPABLE = 0.9; // m: the highest step up a jump from a run can make (the take-off speed 4.5 m/s lifts about 1 m)

const MIN_GAP_M = 1.2; // a crack narrower than this is bridged: nobody jumps a crack
const STEP_M = 0.25; // a jump in height this big between neighbouring cells is a step or a face

export function describe(profile: Profile): SliceReport {
  const c = profile.cells;
  let gaps = 0, steps = 0, faces = 0, curved = 0, run = 0, curveCells = 0;
  let gapLen = 0, prev: number | null = null, lastGround = -1, lastH: number | null = null, maxRise = 0;
  for (let i = 0; i < c.length; i++) {
    const h = c[i];
    if (h === null) { gapLen++; continue; }
    if (gapLen * CELL >= MIN_GAP_M && lastGround >= 0) gaps++;
    gapLen = 0;
    if (lastH !== null) maxRise = Math.max(maxRise, h - lastH); // up from the last ground, across any gap
    lastH = h;
    if (prev !== null && Math.abs(h - prev) >= STEP_M) { if (Math.abs(h - prev) >= 1.2) faces++; else steps++; }
    if (prev !== null && Math.abs(h - prev) > 0.004 && Math.abs(h - prev) < STEP_M * 0.35) { curveCells++; run++; } else { if (run * CELL >= 1) curved++; run = 0; }
    prev = h; lastGround = i;
  }
  if (run * CELL >= 1) curved++;
  void curveCells;
  const length = profile.length;
  const variety = [gaps, steps, curved, faces].filter((n) => n > 0).length;
  const lengthScore = length < 12 ? -2 : length > 70 ? -1 : 1;
  const score = 2 * variety + 0.5 * Math.min(gaps + steps + curved + faces, 8) + lengthScore - 2 * Math.max(0, faces - 2);
  return { gaps, steps, curves: curved, faces, length, variety, maxRise, score };
}

// The lane as a course: a start deck, then each stretch of ground with its real outline, with real gaps (bridged if tiny, capped if huge).
export function laneToCourse(profile: Profile, name = 'Slice'): CourseData {
  const c = profile.cells;
  const runs: { a: number; b: number }[] = [];
  let start = -1;
  for (let i = 0; i <= c.length; i++) {
    const g = i < c.length && c[i] !== null;
    if (g && start < 0) start = i;
    if (!g && start >= 0) { runs.push({ a: start, b: i - 1 }); start = -1; }
  }
  // bridge cracks that are too narrow to jump
  const merged: { a: number; b: number }[] = [];
  for (const r of runs) {
    const last = merged[merged.length - 1];
    if (last && (r.a - last.b - 1) * CELL < MIN_GAP_M) {
      const h0 = c[last.b] as number, h1 = c[r.a] as number;
      for (let i = last.b + 1; i < r.a; i++) c[i] = h0 + ((h1 - h0) * (i - last.b)) / (r.a - last.b);
      last.b = r.b;
    } else merged.push({ ...r });
  }
  const platforms: Platform[] = [{ x0: -10, x1: 6, top: 0 }];
  let x = 6;
  merged.forEach((r, k) => {
    const gapM = k === 0 ? 3 : Math.min(5, (r.a - merged[k - 1].b - 1) * CELL);
    const x0 = x + gapM;
    const pts: [number, number][] = [];
    for (let i = r.a; i <= r.b; i += Math.max(1, Math.floor((r.b - r.a) / 24))) pts.push([x0 + (i - r.a) * CELL, c[i] as number]);
    const last = [x0 + (r.b - r.a) * CELL, c[r.b] as number] as [number, number];
    if (pts[pts.length - 1][0] < last[0]) pts.push(last);
    const x1 = last[0];
    const top = Math.max(...pts.map((p) => p[1]));
    const flat = top - Math.min(...pts.map((p) => p[1])) < 0.02;
    platforms.push({ x0: round(x0), x1: round(x1), top: round(top), ...(flat ? {} : { profile: pts.map(([px, py]) => [round(px), round(py)] as [number, number]) }) });
    x = x1;
  });
  platforms.push({ x0: round(x + 3), x1: round(x + 11), top: 0 });
  return { version: 1, name, startX: 0, finishX: round(x + 5), jumpSpeed: 4.5, terrain: { waterY: -1.5, platforms } };
}
const round = (v: number) => Math.round(v * 100) / 100;

export interface Candidate extends SliceOptions { report: SliceReport; profile: Profile }

// Try every turn of the rod, every sideways step and every level; keep the lanes with the best scores that the simulator can clear.
// Sideways steps for one turn: across the whole width of the scene, about a metre apart (at most 14 lanes).
function offsetsFor(samples: Float32Array, centre: { x: number; z: number }, angle: number, given?: number[]): number[] {
  if (given) return given;
  const nx = -Math.sin(angle), nz = Math.cos(angle);
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < samples.length; i += 3) { const v = (samples[i] - centre.x) * nx + (samples[i + 2] - centre.z) * nz; lo = Math.min(lo, v); hi = Math.max(hi, v); }
  if (hi - lo < 2 * HALF_LANE) return [(lo + hi) / 2];
  const n = Math.min(14, Math.max(1, Math.round(hi - lo - 2 * HALF_LANE)));
  return Array.from({ length: n + 1 }, (_, i) => lo + HALF_LANE + ((hi - lo - 2 * HALF_LANE) * i) / n);
}

export function bestSlices(mesh: Mesh, opts: { angles?: number; offsets?: number[]; levels?: number[]; top?: number } = {}): Candidate[] {
  const samples = surfaceSamples(mesh);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < samples.length; i += 3) { minX = Math.min(minX, samples[i]); maxX = Math.max(maxX, samples[i]); minY = Math.min(minY, samples[i + 1]); maxY = Math.max(maxY, samples[i + 1]); minZ = Math.min(minZ, samples[i + 2]); maxZ = Math.max(maxZ, samples[i + 2]); }
  const centre = { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };
  const turns = opts.angles ?? 18; // 10 degree steps over half a turn (the other half is the same lane run backwards)
  const levels = opts.levels ?? [minY, minY + 0.5, minY + 1];
  const all: Candidate[] = [];
  for (let k = 0; k < turns; k++) for (const offset of offsetsFor(samples, centre, (Math.PI * k) / turns, opts.offsets)) for (const level of levels) {
    const o = { angle: (Math.PI * k) / turns, offset, level };
    const profile = sliceProfile(samples, centre, o);
    if (profile.length < 8) continue;
    const report = describe(profile);
    if (report.maxRise > JUMPABLE) continue; // a step no jump can make: not a course
    all.push({ ...o, profile, report });
  }
  all.sort((a, b) => b.report.score - a.report.score);
  const out: Candidate[] = [];
  for (const cand of all) {
    if (out.length >= (opts.top ?? 3)) break;
    if (out.some((o) => Math.abs(o.angle - cand.angle) < 0.2 && Math.abs(o.offset - cand.offset) < 1.5 && o.level === cand.level)) continue; // not three copies of the same lane
    const found = searchIdealRun(laneToCourse({ cells: [...cand.profile.cells], length: cand.profile.length }));
    if (found.cleared) out.push(cand);
  }
  return out;
}
