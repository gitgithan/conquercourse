import type { Mesh } from '../../slice/slice';

// "Skin versus collider": one ball is rolled over a real lifted object twice, once colliding with the skin (every triangle of the lift) and once with a simple collider.
// Pure and deterministic (a fixed 120 Hz step, no clock, no random except a seeded draw), so the tests and the page run the same code and the same numbers come out.
export const DT = 1 / 120, G = 9.81, BALL_R = 0.1, TARGET_VX = 1.5, MAX_TICKS = 900;
export const RELIFT_SIGMA = 0.005, RELIFT_SEED = 11; // m: the same photo lifted again moves every point by about this much
export const SNAP = 0.05; // m: the collider's size is rounded to a 5 cm cell, the cell the game uses
export const TOP_TOLERANCE = 0.03; // m: how far the collider's top may sit from the skin's top and still count as the same object

export interface Tris { p: Float64Array; n: number } // nine numbers per triangle
export type ColliderKind = 'skin' | 'decimated' | 'box-exact' | 'box-snapped' | 'box-big';
export interface Played { xs: number[]; ys: number[]; ticks: number; fell: boolean; finished: boolean; hash: string; snags: number; maxSlow: number; jitter: number; checks: number; tris: number }

const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
export function rng(seed: number): () => number { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function trisOf(m: Mesh): Tris {
  const idx = m.indices ?? [], p = m.positions, n = Math.floor(idx.length / 3), out = new Float64Array(n * 9);
  for (let t = 0; t < n; t++) for (let k = 0; k < 3; k++) for (let c = 0; c < 3; c++) out[t * 9 + k * 3 + c] = p[idx[t * 3 + k] * 3 + c];
  return { p: out, n };
}
export function bounds(m: Mesh): { lo: number[]; hi: number[] } {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], p = m.positions;
  for (let i = 0; i < p.length; i += 3) for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], p[i + c]); hi[c] = Math.max(hi[c], p[i + c]); }
  return { lo, hi };
}

// The same photo lifted a second time: every point moves a little, in a seeded way. The shape is the same object; the triangles are not the same triangles.
export function relift(m: Mesh, sigma = RELIFT_SIGMA, seed = RELIFT_SEED): Mesh {
  const r = rng(seed), p = Array.from(m.positions);
  for (let i = 0; i < p.length; i++) p[i] += (r() * 2 - 1) * sigma;
  return { positions: p, indices: m.indices };
}

// Skin detail: vertex clustering. The points are snapped to a grid, the grid is made coarser until no more than `target` triangles are left; flat or collapsed triangles go.
export function decimate(m: Mesh, target: number): Mesh {
  const mi = m.indices ?? [], total = Math.floor(mi.length / 3);
  if (target >= total) return m;
  const { lo, hi } = bounds(m), span = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
  const build = (cells: number): Mesh => {
    const cs = span / cells, key = new Map<string, number>(), sum: number[][] = [], map = new Int32Array(m.positions.length / 3);
    for (let i = 0; i < map.length; i++) {
      const q = [0, 1, 2].map((c) => Math.floor((m.positions[i * 3 + c] - lo[c]) / cs)), k = q.join(',');
      let id = key.get(k); if (id === undefined) { id = sum.length; key.set(k, id); sum.push([0, 0, 0, 0]); }
      map[i] = id; for (let c = 0; c < 3; c++) sum[id][c] += m.positions[i * 3 + c]; sum[id][3]++;
    }
    const positions: number[] = []; for (const s of sum) positions.push(s[0] / s[3], s[1] / s[3], s[2] / s[3]);
    const indices: number[] = [], seen = new Set<string>();
    for (let t = 0; t < total; t++) {
      const a = map[mi[t * 3]], b = map[mi[t * 3 + 1]], c = map[mi[t * 3 + 2]];
      if (a === b || b === c || a === c) continue;
      const k = [a, b, c].sort((x, y) => x - y).join(','); if (seen.has(k)) continue; seen.add(k);
      indices.push(a, b, c);
    }
    return { positions, indices };
  };
  let a = 2, b = 400, best = build(2); // fewest cells that still keep the count under the target: bisect on the cell count
  while (b - a > 1) { const mid = (a + b) >> 1, g = build(mid); if ((g.indices?.length ?? 0) / 3 <= target) { a = mid; best = g; } else b = mid; }
  return best;
}

// A box collider as 12 triangles. exact: the skin's own bounds. snapped: each side rounded to the 5 cm cell. big: a loose box, a metre of margin on top.
export function boxMesh(lo: number[], hi: number[]): Mesh {
  const P: number[] = []; for (const z of [lo[2], hi[2]]) for (const y of [lo[1], hi[1]]) for (const x of [lo[0], hi[0]]) P.push(x, y, z);
  const q = (x: number, y: number, z: number) => x + 2 * y + 4 * z;
  const f = (a: number, b: number, c: number, d: number) => [a, b, c, a, c, d];
  const I = [...f(q(0, 0, 0), q(0, 1, 0), q(1, 1, 0), q(1, 0, 0)), ...f(q(0, 0, 1), q(1, 0, 1), q(1, 1, 1), q(0, 1, 1)), ...f(q(0, 0, 0), q(0, 0, 1), q(0, 1, 1), q(0, 1, 0)), ...f(q(1, 0, 0), q(1, 1, 0), q(1, 1, 1), q(1, 0, 1)), ...f(q(0, 1, 0), q(0, 1, 1), q(1, 1, 1), q(1, 1, 0)), ...f(q(0, 0, 0), q(1, 0, 0), q(1, 0, 1), q(0, 0, 1))];
  return { positions: P, indices: I };
}
export function colliderFor(kind: ColliderKind, skin: Mesh, detail = 600): Mesh {
  const { lo, hi } = bounds(skin), snap = (v: number) => Math.round(v / SNAP) * SNAP;
  if (kind === 'skin') return skin;
  if (kind === 'decimated') return decimate(skin, detail);
  if (kind === 'box-exact') return boxMesh(lo, hi);
  if (kind === 'box-snapped') return boxMesh(lo.map(snap), hi.map(snap));
  return boxMesh(lo.map((v) => snap(v) - 0.5), hi.map((v, i) => snap(v) + (i === 1 ? 1 : 0.5))); // 'box-big'
}

function closest(t: Float64Array, o: number, px: number, py: number, pz: number, out: number[]): void { // Ericson, Real-Time Collision Detection, 5.1.5
  const ax = t[o], ay = t[o + 1], az = t[o + 2], bx = t[o + 3], by = t[o + 4], bz = t[o + 5], cx = t[o + 6], cy = t[o + 7], cz = t[o + 8];
  const abx = bx - ax, aby = by - ay, abz = bz - az, acx = cx - ax, acy = cy - ay, acz = cz - az, apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  const set = (x: number, y: number, z: number) => { out[0] = x; out[1] = y; out[2] = z; };
  if (d1 <= 0 && d2 <= 0) return set(ax, ay, az);
  const bpx = px - bx, bpy = py - by, bpz = pz - bz, d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) return set(bx, by, bz);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return set(ax + v * abx, ay + v * aby, az + v * abz); }
  const cpx = px - cx, cpy = py - cy, cpz = pz - cz, d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) return set(cx, cy, cz);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return set(ax + w * acx, ay + w * acy, az + w * acz); }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return set(bx + w * (cx - bx), by + w * (cy - by), bz + w * (cz - bz)); }
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
  set(ax + abx * v + acx * w, ay + aby * v + acy * w, az + abz * v + acz * w);
}

export function fnv(xs: number[], ys: number[]): string { // 1 mm steps: two runs share a hash only if every tick is within a millimetre
  let h = 0x811c9dc5;
  const mix = (v: number) => { h ^= v & 0xffff; h = Math.imul(h, 0x01000193) >>> 0; h ^= (v >>> 16) & 0xffff; h = Math.imul(h, 0x01000193) >>> 0; };
  for (let i = 0; i < xs.length; i++) { mix(Math.round(xs[i] * 1000) | 0); mix(Math.round(ys[i] * 1000) | 0); }
  return h.toString(16).padStart(8, '0');
}

// The ball: dropped just inside the left end, pushed to a steady 1.5 m/s along the object's long side, until it leaves the right end. Collision is a sphere against the given triangles.
// Contact removes the speed that points into the surface and pushes the ball out. A bump on the skin therefore slows the ball (a snag) and lifts it (jitter).
export function roll(col: Mesh, frame: { lo: number[]; hi: number[] }): Played {
  const T = trisOf(col), t = T.p, bb = new Float64Array(T.n * 6);
  for (let k = 0; k < T.n; k++) for (let c = 0; c < 3; c++) { const a = t[k * 9 + c], b = t[k * 9 + 3 + c], d = t[k * 9 + 6 + c]; bb[k * 6 + c] = Math.min(a, b, d) - BALL_R; bb[k * 6 + 3 + c] = Math.max(a, b, d) + BALL_R; }
  const { lo, hi } = frame, axis = hi[0] - lo[0] >= hi[2] - lo[2] ? 0 : 2, o = axis === 0 ? 2 : 0;
  const z0 = (lo[o] + hi[o]) / 2, endX = hi[axis] + 0.3;
  let x = lo[axis] + 0.25, y = hi[1] + 0.5, vx = 0, vy = 0;
  const xs: number[] = [], ys: number[] = [], q = [0, 0, 0], on: boolean[] = [];
  let checks = 0, finished = false, fell = false, snags = 0, maxSlow = 0, wasSlow = false;
  const P = [0, 0, 0];
  for (let tick = 0; tick < MAX_TICKS; tick++) {
    vx += Math.max(-6, Math.min(6, (TARGET_VX - vx) * 8)) * DT; vy -= G * DT; x += vx * DT; y += vy * DT;
    let touch = false; checks += T.n; // one check per triangle per tick (what a ball pays without a grid)
    for (let it = 0; it < 3; it++) {
      let hit = false;
      for (let k = 0; k < T.n; k++) {
        const b = k * 9;
        P[axis] = x; P[1] = y; P[o] = z0; // cost counts every triangle as checked; the box test below is only a speed-up for the page
        if (P[0] < bb[k * 6] || P[0] > bb[k * 6 + 3] || P[1] < bb[k * 6 + 1] || P[1] > bb[k * 6 + 4] || P[2] < bb[k * 6 + 2] || P[2] > bb[k * 6 + 5]) continue;
        closest(t, b, P[0], P[1], P[2], q);
        const dx = P[0] - q[0], dy = P[1] - q[1], dz = P[2] - q[2], d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= BALL_R * BALL_R || d2 < 1e-18) continue;
        const d = Math.sqrt(d2), nx = (axis === 0 ? dx : dz) / d, ny = dy / d; // only the way along the object and up count: the ball rolls on the middle line
        const push = BALL_R - d; x += nx * push; y += ny * push;
        const vn = vx * nx + vy * ny; if (vn < 0) { vx -= vn * nx; vy -= vn * ny; }
        hit = true; touch = true;
      }
      if (!hit) break;
    }
    on.push(touch); xs.push(r6(x)); ys.push(r6(y));
    if (touch) { const slow = vx < TARGET_VX * 0.85; if (slow && !wasSlow) snags++; wasSlow = slow; maxSlow = Math.max(maxSlow, TARGET_VX - vx); } else wasSlow = false;
    if (x > endX) { finished = true; break; }
    if (y < -1) { fell = true; break; }
  }
  let j = 0, n = 0; // jitter: how much the height bends from tick to tick while the ball is in contact (mm per tick)
  for (let i = 2; i < ys.length; i++) if (on[i] && on[i - 1] && on[i - 2]) { const d = (ys[i] - 2 * ys[i - 1] + ys[i - 2]) * 1000; j += d * d; n++; }
  return { xs, ys, ticks: xs.length, fell, finished, hash: fnv(xs, ys), snags, maxSlow: Math.round(maxSlow * 1000) / 1000, jitter: n ? Math.round(Math.sqrt(j / n) * 1000) / 1000 : 0, checks, tris: T.n };
}

export interface Trial { kind: ColliderKind; a: Played; b: Played; same: boolean; topErr: number; ok: boolean; tris: number }
// The test the challenge uses: lift the photo twice (b is a re-lift with 5 mm of change), build the collider from each, roll the same ball over both.
// A collider keeps the run if the two runs are identical tick for tick (same hash), the ball finishes, and the collider's top sits within 3 cm of the skin's top.
export function trial(skin: Mesh, kind: ColliderKind, detail = 600, sigma = RELIFT_SIGMA): Trial {
  const skin2 = relift(skin, sigma), cA = colliderFor(kind, skin, detail), cB = colliderFor(kind, skin2, detail);
  const fa = bounds(skin), a = roll(cA, fa), b = roll(cB, fa); // the ball starts at the same place in the world whichever lift it is
  const topErr = Math.round(Math.abs(bounds(cA).hi[1] - fa.hi[1]) * 1000) / 1000;
  const same = a.hash === b.hash;
  return { kind, a, b, same, topErr, tris: a.tris, ok: same && a.finished && b.finished && topErr <= TOP_TOLERANCE };
}
export const COLLIDERS: { kind: ColliderKind; name: string }[] = [
  { kind: 'skin', name: 'The skin itself' }, { kind: 'decimated', name: 'A thinner skin' },
  { kind: 'box-exact', name: 'A box as tight as the skin' }, { kind: 'box-snapped', name: 'A box rounded to a 5 cm cell' }, { kind: 'box-big', name: 'A loose, big box' },
];
export const OBJECTS: { id: string; name: string; url: string; credit: string }[] = [
  { id: 'box-skate-03', name: 'Skate box', url: '/assets/lab/lift/real/box-skate-03.glb', credit: 'Photo by Alexis Jazz, CC BY 4.0' },
  { id: 'gabion-wall', name: 'Gabion wall', url: '/assets/lab/lift/real/gabion-wall.glb', credit: 'Photo by Encik Tekateki, CC0' },
  { id: 'bollard-iron', name: 'Iron bollard', url: '/assets/lab/lift/real/bollard-iron.glb', credit: 'Photo by Simon Cobb, CC0' },
  { id: 'stump-spruce', name: 'Spruce stump', url: '/assets/lab/lift/real/stump-spruce.glb', credit: 'Photo by W.carter, CC0' },
  { id: 'planter-concrete', name: 'Concrete planter', url: '/assets/lab/lift/real/planter-concrete.glb', credit: 'Photo by Tony Webster, CC BY 2.0' },
];
