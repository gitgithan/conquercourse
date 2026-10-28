import { LANE_DROP } from '../sim/drop';
import type { CourseData } from '../course/course';
import type { Platform } from '../sim/terrain';
import { searchIdealRun } from '../sim/ideal';
import { gapSpecs } from '../sim/needs';

// Cutting a 2 m lane out of a 3D scene to make a course (docs/world-slice.md).
// A scene is turned about a vertical rod through its middle; each turn, each sideways step and each height level gives
// a different lane. The lane's top outline becomes the ground; the search keeps the lane with the most interesting shapes.
// Pure maths on points: no page, no scene graph. y is up.

export interface Mesh { positions: ArrayLike<number>; indices?: ArrayLike<number> } // xyz triples; triangles if indices are given

// No cap on the height above the level: what a runner can reach is decided by the moves (a step above a jump is simply not a course),
// and what it can survive going down by the landing physics (LANE_DROP, src/sim/drop.ts).
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

export interface Profile { cells: (number | null)[]; length: number; origin?: number } // origin: where cell 0 sits along the run in the editor's world, in metres // height above the level per 0.1 m along the run, null where there is no ground

export function sliceProfile(samples: Float32Array, centre: { x: number; z: number }, o: SliceOptions): Profile {
  const dx = Math.cos(o.angle), dz = Math.sin(o.angle), nx = -dz, nz = dx;
  const tops = new Map<number, number>();
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < samples.length; i += 3) {
    const x = samples[i] - centre.x, z = samples[i + 2] - centre.z, y = samples[i + 1] - o.level;
    if (Math.abs(x * nx + z * nz - o.offset) > HALF_LANE || y < -LANE_DROP) continue; // outside the lane, or further below the level than a runner can drop (water)
    const u = Math.floor((x * dx + z * dz) / CELL);
    lo = Math.min(lo, u); hi = Math.max(hi, u);
    if (y > (tops.get(u) ?? -Infinity)) tops.set(u, y);
  }
  if (lo > hi) return { cells: [], length: 0 };
  const cells: (number | null)[] = [];
  for (let u = lo; u <= hi; u++) cells.push(tops.get(u) ?? null);
  return { cells, length: cells.length * CELL, origin: lo * CELL };
}

// What a lane contains, and how interesting it is for a runner.
export interface SliceReport { gaps: number; steps: number; curves: number; faces: number; length: number; variety: number; maxRise: number; maxDrop: number; score: number }

export const JUMPABLE = 0.9; // m: the highest step up a jump from a run can make (the take-off speed 4.5 m/s lifts about 1 m)

const MIN_GAP_M = 1.2; // a crack narrower than this is bridged: nobody jumps a crack
const STEP_M = 0.25; // a jump in height this big between neighbouring cells is a step or a face

export function describe(profile: Profile): SliceReport {
  const c = profile.cells;
  let gaps = 0, steps = 0, faces = 0, curved = 0, run = 0, curveCells = 0;
  let gapLen = 0, prev: number | null = null, lastGround = -1, lastH: number | null = null, maxRise = 0, maxDrop = 0;
  for (let i = 0; i < c.length; i++) {
    const h = c[i];
    if (h === null) { gapLen++; continue; }
    if (gapLen * CELL >= MIN_GAP_M && lastGround >= 0) gaps++;
    gapLen = 0;
    if (lastH !== null) { maxRise = Math.max(maxRise, h - lastH); maxDrop = Math.max(maxDrop, lastH - h); } // up or down from the last ground, across any gap
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
  return { gaps, steps, curves: curved, faces, length, variety, maxRise, maxDrop, score };
}

// The lane as a course: a start deck, then each stretch of ground with its real outline, with real gaps (bridged if tiny, capped if huge).
// holds: bars in the air in the editor's world (u along the run, y above the level). A lane with bars keeps its real gaps (they are what the swing has to cross)
// and its jumps cost speed at take-off (jumpKeep), so a vault and a swing are worth learning.
export interface LanePlank { u0: number; u1: number; thickness: number; width: number; material: 'wood' | 'steel'; support: boolean } // a plank piece along the lane (src/slice/plank-world.ts)
// opts.keepGaps: keep real gaps up to 14 m even without bars (a rope needs the gap it swings over).
// opts.splits: u positions (along the run, in the editor's world) where a run of ground is cut into two platforms, so a wall face or the two ends of a trampoline bed are real platform edges.
export interface LaneOptions { keepGaps?: boolean; splits?: number[] }
export function laneToCourse(profile: Profile, name = 'Slice', holds: { u: number; y: number }[] = [], opts: LaneOptions = {}, planks: LanePlank[] = []): CourseData {
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
  const origin = profile.origin ?? 0;
  if (opts.splits?.length) {
    const cut: { a: number; b: number }[] = [];
    for (const r of merged) {
      let a = r.a;
      const at = opts.splits.map((u) => Math.round((u - origin) / CELL)).filter((i) => i > r.a && i < r.b).sort((p, q) => p - q);
      for (const i of at) if (i > a) { cut.push({ a, b: i - 1 }); a = i; }
      cut.push({ a, b: r.b });
    }
    merged.length = 0; merged.push(...cut);
  }
  const platforms: Platform[] = [{ x0: -10, x1: 6, top: 0 }];
  const uMap: { u0: number; u1: number; x0: number }[] = []; // where each run of ground in the editor's world sits in the game (gaps are squeezed)
  let x = 6;
  merged.forEach((r, k) => {
    const realGap = k === 0 ? 3 : (r.a - merged[k - 1].b - 1) * CELL;
    const firstU = holds.length ? Math.min(...holds.map((h) => h.u)) : Infinity;
    const gapM = holds.length || planks.length ? (k === 0 ? Math.max(3, origin + r.a * CELL - firstU + 2.5) : Math.min(14, realGap)) : k === 0 ? 3 : Math.min(opts.keepGaps ? 14 : 5, realGap);
    const x0 = x + gapM;
    const pts: [number, number][] = [];
    for (let i = r.a; i <= r.b; i += Math.max(1, Math.floor((r.b - r.a) / 24))) pts.push([x0 + (i - r.a) * CELL, c[i] as number]);
    const last = [x0 + (r.b - r.a) * CELL, c[r.b] as number] as [number, number];
    if (pts[pts.length - 1][0] < last[0]) pts.push(last);
    const x1 = last[0];
    const top = Math.max(...pts.map((p) => p[1]));
    const flat = top - Math.min(...pts.map((p) => p[1])) < 0.02;
    uMap.push({ u0: origin + r.a * CELL, u1: origin + (r.b + 1) * CELL, x0: round(x0) });
    platforms.push({ x0: round(x0), x1: round(x1), top: round(top), ...(flat ? {} : { profile: pts.map(([px, py]) => [round(px), round(py)] as [number, number]) }) });
    x = x1;
  });
  const lastH = merged.length ? (c[merged[merged.length - 1].b] as number) : 0;
  const endTop = lastH > 1 ? lastH - 1 : Math.min(0, lastH); // the finish deck: a metre below a high ending (a short drop across the gap), the old flat deck after a low one, level with a deep one
  platforms.push({ x0: round(x + 3), x1: round(x + 11), top: round(endTop) });
  const lowest = Math.min(0, endTop, ...platforms.map((p) => Math.min(p.top, ...(p.profile ?? []).map(([, py]) => py))));
  const mapped = holds.map((h) => {
    let best = uMap[0], d = Infinity;
    for (const r of uMap) { const dd = h.u < r.u0 ? r.u0 - h.u : h.u > r.u1 ? h.u - r.u1 : 0; if (dd < d) { d = dd; best = r; } }
    return best ? { x: round(h.u + (best.x0 - best.u0)), y: round(h.y) } : null;
  }).filter((h): h is { x: number; y: number } => h !== null).sort((a, b) => a.x - b.x);
  // a plank lies across a gap: it starts where one run of ground ends and ends where the next begins (platform 0 is the start deck)
  const laid: NonNullable<CourseData['planks']> = [];
  for (const pl of planks) {
    const mid = (pl.u0 + pl.u1) / 2;
    const k = uMap.findIndex((r, i) => i + 1 < uMap.length && mid >= r.u1 - 0.5 && mid <= uMap[i + 1].u0 + 0.5 && pl.u0 <= r.u1 + 1.5 && pl.u1 >= uMap[i + 1].u0 - 1.5); // the plank lies across this gap and reaches both sides
    if (k < 0) continue;
    const a = platforms[1 + k], b = platforms[2 + k];
    if (!a || !b || Math.abs(a.top - b.top) > 0.05 || b.x0 - a.x1 < 1) continue;
    laid.push({ x0: round(a.x1), x1: round(b.x0), y: round(a.top), thickness: pl.thickness, width: pl.width, material: pl.material, ...(pl.support ? { support: true } : {}) });
  }
  return { version: 1, name, startX: 0, finishX: round(x + 5), jumpSpeed: 4.5, terrain: { waterY: Math.min(-1.5, round(lowest - 1.5)), platforms }, uMap, ...(mapped.length ? { holds: mapped, jumpKeep: 0.88 } : {}), ...(laid.length ? { planks: laid } : {}) };
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

// prove: false returns the best lanes by their shape without the slow simulator proof (the Slicer shows them at once); maxProofs: how many lanes to try to clear (default 12).
export function bestSlices(mesh: Mesh, opts: { angles?: number; offsets?: number[]; levels?: number[]; top?: number; centre?: { x: number; z: number }; prove?: boolean; maxProofs?: number } = {}): Candidate[] {
  const samples = surfaceSamples(mesh);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < samples.length; i += 3) { minX = Math.min(minX, samples[i]); maxX = Math.max(maxX, samples[i]); minY = Math.min(minY, samples[i + 1]); maxY = Math.max(maxY, samples[i + 1]); minZ = Math.min(minZ, samples[i + 2]); maxZ = Math.max(maxZ, samples[i + 2]); }
  const centre = opts.centre ?? { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 }; // the rod: the middle of the scene unless the caller has its own (the editor's is the origin)
  const turns = opts.angles ?? 18; // 10 degree steps over half a turn (the other half is the same lane run backwards)
  const levels = opts.levels ?? [minY, minY + 0.5, minY + 1, minY + 3, minY + 6]; // the higher levels start the lane on a roof, so the way down is a drop
  const all: Candidate[] = [];
  for (let k = 0; k < turns; k++) for (const offset of offsetsFor(samples, centre, (Math.PI * k) / turns, opts.offsets)) for (const level of levels) {
    const o = { angle: (Math.PI * k) / turns, offset, level };
    const profile = sliceProfile(samples, centre, o);
    if (profile.length < 8) continue;
    const report = describe(profile);
    if (report.maxRise > JUMPABLE) continue; // a step no jump can make: not a course
    if (report.maxDrop > LANE_DROP) continue; // a fall no roll survives: not a course
    all.push({ ...o, profile, report });
  }
  all.sort((a, b) => b.report.score - a.report.score);
  const out: Candidate[] = [];
  let proofs = 0;
  for (const cand of all) {
    if (out.length >= (opts.top ?? 3)) break;
    if (out.some((o) => Math.abs(o.angle - cand.angle) < 0.2 && Math.abs(o.offset - cand.offset) < 1.5 && o.level === cand.level)) continue; // not three copies of the same lane
    if (opts.prove === false) { out.push(cand); continue; }
    const course = laneToCourse({ cells: [...cand.profile.cells], length: cand.profile.length });
    if (gapSpecs(course).some((g) => g.needed > 8.5)) continue; // a gap needing nearly top speed is not a fair lane: skip the slow proof
    if (++proofs > (opts.maxProofs ?? 12)) break; // proving a lane costs a full ideal-run search: try at most this many
    if (searchIdealRun(course).cleared) out.push(cand);
  }
  return out;
}
