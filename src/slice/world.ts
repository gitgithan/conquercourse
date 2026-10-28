import { laneSamples, sliceProfile, surfaceSamples, type Mesh, type Profile, type SliceOptions } from './slice';

// A world made of pieces. A piece is a mesh with a place (x, z on the ground, a height off the ground), a turn about the vertical,
// and a scale: the same toy brick can be a 3 cm model or a half-metre block. The course is a lane cut from the whole world.
// What a piece does in the course (src/slice/roles.ts): plain ground (or nothing set), the Warped Wall, a rope anchor, or a trampoline bed.
export type Role = 'ground' | 'wall' | 'rope' | 'trampoline';

export interface Piece {
  id: number;
  name: string;
  mesh: Mesh; // in its own units, standing on y = 0, centred on x and z = 0
  x: number; z: number; y: number; // metres
  yaw: number; // radians about the vertical rod
  scale: number; // metres per mesh unit
  role?: Role;
  noGround?: boolean; // an overhead or laid-across piece (a bar, a plank): it is not ground, the slice ignores it
}

export interface Box2 { x0: number; z0: number; x1: number; z1: number } // in the piece's own units, before scale and turn

let nextId = 1;
export const newPiece = (name: string, mesh: Mesh, at: { x: number; z: number } = { x: 0, z: 0 }): Piece => ({ id: nextId++, name, mesh: centred(mesh), x: at.x, z: at.z, y: 0, yaw: 0, scale: 1 });

// Put the mesh on the ground (lowest point y = 0) and in the middle (x and z).
export function centred(m: Mesh): Mesh {
  const p = Array.from(m.positions as ArrayLike<number>);
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y0 = Infinity;
  for (let i = 0; i < p.length; i += 3) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); z0 = Math.min(z0, p[i + 2]); z1 = Math.max(z1, p[i + 2]); }
  for (let i = 0; i < p.length; i += 3) { p[i] -= (x0 + x1) / 2; p[i + 1] -= y0; p[i + 2] -= (z0 + z1) / 2; }
  return { positions: p, indices: m.indices };
}

export function size(m: Mesh): { w: number; h: number; d: number } {
  const p = m.positions;
  let x0 = Infinity, x1 = -Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < p.length; i += 3) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y1 = Math.max(y1, p[i + 1]); z0 = Math.min(z0, p[i + 2]); z1 = Math.max(z1, p[i + 2]); }
  return { w: x1 - x0, h: y1, d: z1 - z0 };
}

// Real size of a piece in metres, from its mesh and its scale.
export const realSize = (p: Piece) => { const s = size(p.mesh); return { w: s.w * p.scale, h: s.h * p.scale, d: s.d * p.scale }; };

// Make a piece this many metres high (the way to say "this toy model is half a metre tall").
export const scaleToHeight = (p: Piece, metres: number): Piece => ({ ...p, scale: metres / Math.max(1e-9, size(p.mesh).h) });
export const scaleBy = (p: Piece, k: number): Piece => ({ ...p, scale: p.scale * k });

// Copy and paste: the same mesh, a little to one side.
export const duplicate = (p: Piece, dx = 1, dz = 1): Piece => ({ ...p, id: nextId++, name: p.name, x: p.x + dx, z: p.z + dz });

// Crop: keep only the part of the mesh whose triangles lie inside a box (in the piece's own units); the rest is cut away.
export function crop(p: Piece, b: Box2): Piece | null {
  const pos = p.mesh.positions, idx = p.mesh.indices;
  if (!idx) return null;
  // cut every triangle at the box's four sides (so a big flat face is cut too), keeping what is inside
  const outP: number[] = [], outI: number[] = [];
  const planes: [number, number, number][] = [[1, 0, -b.x0], [-1, 0, b.x1], [0, 1, -b.z0], [0, -1, b.z1]]; // a*x + c*z + d >= 0 is inside
  for (let t = 0; t + 2 < idx.length; t += 3) {
    let poly: number[][] = [0, 1, 2].map((k) => [pos[idx[t + k] * 3], pos[idx[t + k] * 3 + 1], pos[idx[t + k] * 3 + 2]]);
    for (const [a, c, d] of planes) {
      const next: number[][] = [];
      for (let i = 0; i < poly.length; i++) {
        const A = poly[i], B = poly[(i + 1) % poly.length];
        const fa = a * A[0] + c * A[2] + d, fb = a * B[0] + c * B[2] + d;
        if (fa >= 0) next.push(A);
        if ((fa >= 0) !== (fb >= 0)) { const k = fa / (fa - fb); next.push([A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k]); }
      }
      poly = next;
      if (poly.length < 3) break;
    }
    if (poly.length < 3) continue;
    const base = outP.length / 3;
    for (const v of poly) outP.push(v[0], v[1], v[2]);
    for (let i = 1; i + 1 < poly.length; i++) outI.push(base, base + i, base + i + 1);
  }
  if (!outI.length) return null;
  // the part that stays keeps its place in the world: re-centre the mesh and move the piece to match
  const m = centredWith({ positions: outP, indices: outI });
  const cos = Math.cos(p.yaw), sin = Math.sin(p.yaw);
  const ox = m.dx * p.scale, oz = m.dz * p.scale;
  return { ...p, id: nextId++, mesh: m.mesh, x: p.x + ox * cos - oz * sin, z: p.z + ox * sin + oz * cos };
}
function centredWith(m: Mesh): { mesh: Mesh; dx: number; dz: number } {
  const used = new Set(Array.from(m.indices!));
  const map = new Map<number, number>();
  const p: number[] = [];
  for (const i of used) { map.set(i, p.length / 3); p.push(m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]); }
  const idx = Array.from(m.indices!).map((i) => map.get(i)!);
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < p.length; i += 3) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); z0 = Math.min(z0, p[i + 2]); z1 = Math.max(z1, p[i + 2]); }
  const dx = (x0 + x1) / 2, dz = (z0 + z1) / 2;
  for (let i = 0; i < p.length; i += 3) { p[i] -= dx; p[i + 2] -= dz; }
  return { mesh: { positions: p, indices: idx }, dx, dz };
}

// Points over the surface of a piece in the world (about 600 per square metre of its real surface, at most `cap`).
const cache = new WeakMap<Mesh, Map<string, Float32Array>>();
export function pieceSamples(p: Piece, perM2 = 600, cap = 40000): Float32Array {
  const key = `${p.scale.toPrecision(5)}:${perM2}`;
  const byScale = cache.get(p.mesh) ?? new Map<string, Float32Array>();
  cache.set(p.mesh, byScale);
  let local = byScale.get(key);
  if (!local) {
    // sampling density per mesh unit² so that the density per real m² is perM2 (the area grows with scale²)
    let d = perM2 * p.scale * p.scale;
    local = surfaceSamples(p.mesh, d);
    while (local.length / 3 > cap && d > 1) { d /= 2; local = surfaceSamples(p.mesh, d); }
    byScale.set(key, local);
  }
  const out = new Float32Array(local.length), c = Math.cos(p.yaw), s = Math.sin(p.yaw);
  for (let i = 0; i < local.length; i += 3) {
    const x = local[i] * p.scale, z = local[i + 2] * p.scale;
    out[i] = p.x + x * c - z * s; out[i + 1] = p.y + local[i + 1] * p.scale; out[i + 2] = p.z + x * s + z * c;
  }
  return out;
}

export function worldSamples(pieces: Piece[]): Float32Array {
  const parts = pieces.filter((p) => !p.noGround).map((p) => pieceSamples(p));
  const out = new Float32Array(parts.reduce((n, a) => n + a.length, 0));
  let at = 0;
  for (const a of parts) { out.set(a, at); at += a.length; }
  return out;
}

// Where a world point lies in a piece's footprint (for picking with the mouse): inside its turned, scaled rectangle.
export function hits(p: Piece, x: number, z: number): boolean {
  const s = size(p.mesh), c = Math.cos(-p.yaw), sn = Math.sin(-p.yaw);
  const lx = ((x - p.x) * c - (z - p.z) * sn) / p.scale, lz = ((x - p.x) * sn + (z - p.z) * c) / p.scale;
  return Math.abs(lx) <= s.w / 2 && Math.abs(lz) <= s.d / 2;
}

// Every read of a lane from the world goes through here (CC-91): a piece whose whole-surface sample was thinned by the cap is read again along the lane at full density,
// so the map, the editor and Fix it all see the same steps and walls on the same lane.
const areaOf = new WeakMap<Mesh, number>();
function meshArea(m: Mesh): number {
  let a = areaOf.get(m);
  if (a === undefined) {
    a = 0;
    const p = m.positions, idx = m.indices;
    if (idx) for (let t = 0; t + 2 < idx.length; t += 3) {
      const i = idx[t] * 3, j = idx[t + 1] * 3, k = idx[t + 2] * 3;
      const ux = p[j] - p[i], uy = p[j + 1] - p[i + 1], uz = p[j + 2] - p[i + 2], vx = p[k] - p[i], vy = p[k + 1] - p[i + 1], vz = p[k + 2] - p[i + 2];
      a += 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
    }
    areaOf.set(m, a);
  }
  return a;
}
const thinned = (p: Piece, perM2 = 600, cap = 40000) => !!p.mesh.indices && meshArea(p.mesh) * p.scale * p.scale * perM2 > cap;
function worldMeshOf(p: Piece): Mesh { // the piece in world coordinates (scale, turn, place)
  const src = p.mesh.positions, out = new Array<number>(src.length), c = Math.cos(p.yaw), s = Math.sin(p.yaw);
  for (let i = 0; i < src.length; i += 3) {
    const x = src[i] * p.scale, z = src[i + 2] * p.scale;
    out[i] = p.x + x * c - z * s; out[i + 1] = p.y + src[i + 1] * p.scale; out[i + 2] = p.z + x * s + z * c;
  }
  return { positions: out, indices: p.mesh.indices };
}
export function laneProfile(pieces: Piece[], lane: SliceOptions, centre: { x: number; z: number } = { x: 0, z: 0 }): Profile {
  const parts = pieces.filter((p) => !p.noGround).map((p) => (thinned(p) ? laneSamples(worldMeshOf(p), lane, centre) : pieceSamples(p)));
  const all = new Float32Array(parts.reduce((n, a) => n + a.length, 0));
  let at = 0;
  for (const a of parts) { all.set(a, at); at += a.length; }
  return sliceProfile(all, centre, lane);
}
