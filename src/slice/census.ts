import type { Mesh } from './slice';

// Defects a render hides: wrong size (a 100x scale bug), holes, flipped or empty triangles, loose points.
export interface Census {
  size: [number, number, number]; // m, x y z extents
  triangles: number;
  openEdges: number; // edges used by one triangle (a hole)
  nonManifoldEdges: number; // edges used by three or more triangles
  flippedEdges: number; // two triangles walk the shared edge the same way
  looseVertices: number;
  degenerate: number; // triangles with (almost) no area
}

export function meshCensus(mesh: Mesh): Census {
  const p = mesh.positions, n = p.length / 3;
  const idx = mesh.indices ?? Array.from({ length: n }, (_, i) => i);
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[i * 3 + k]); hi[k] = Math.max(hi[k], p[i * 3 + k]); }
  // Weld vertices that sit in the same place, so seams between separate meshes do not count as holes.
  const key = (i: number) => `${Math.round(p[i * 3] * 1e4)},${Math.round(p[i * 3 + 1] * 1e4)},${Math.round(p[i * 3 + 2] * 1e4)}`;
  const weld = new Map<string, number>(), id = new Int32Array(n);
  for (let i = 0; i < n; i++) { const k = key(i); if (!weld.has(k)) weld.set(k, weld.size); id[i] = weld.get(k)!; }
  const edges = new Map<string, { up: number; down: number }>(), used = new Set<number>();
  let degenerate = 0;
  for (let t = 0; t + 2 < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    const ux = p[b * 3] - p[a * 3], uy = p[b * 3 + 1] - p[a * 3 + 1], uz = p[b * 3 + 2] - p[a * 3 + 2];
    const vx = p[c * 3] - p[a * 3], vy = p[c * 3 + 1] - p[a * 3 + 1], vz = p[c * 3 + 2] - p[a * 3 + 2];
    const area = 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
    if (area <= 1e-6) { degenerate++; continue; }
    for (const [x, y] of [[a, b], [b, c], [c, a]]) {
      used.add(id[x]); used.add(id[y]);
      if (id[x] === id[y]) continue;
      const k = id[x] < id[y] ? `${id[x]}_${id[y]}` : `${id[y]}_${id[x]}`, e = edges.get(k) ?? { up: 0, down: 0 };
      if (id[x] < id[y]) e.up++; else e.down++;
      edges.set(k, e);
    }
  }
  let openEdges = 0, nonManifoldEdges = 0, flippedEdges = 0;
  for (const e of edges.values()) {
    const total = e.up + e.down;
    if (total === 1) openEdges++;
    else if (total > 2) nonManifoldEdges++;
    else if (e.up === 2 || e.down === 2) flippedEdges++;
  }
  return {
    size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]],
    triangles: Math.floor(idx.length / 3),
    openEdges, nonManifoldEdges, flippedEdges,
    looseVertices: weld.size - used.size,
    degenerate,
  };
}

// Problems worth refusing an object for. `maxEdge` is the longest side a park object may have, in metres.
export function censusProblems(c: Census, maxEdge = 12): string[] {
  const out: string[] = [];
  const longest = Math.max(...c.size), smallest = Math.min(...c.size);
  if (longest > maxEdge) out.push(`longest side ${longest.toFixed(1)} m is bigger than a park object (scale bug?)`);
  if (longest < 0.05) out.push(`longest side ${(longest * 100).toFixed(1)} cm is tiny (scale bug?)`);
  if (smallest < 0 || !Number.isFinite(longest)) out.push('mesh has no size');
  // A few stray triangles are normal in a photo-made mesh; refuse only when more than 1% of the mesh is affected.
  const few = (count: number) => count <= 0.01 * c.triangles;
  if (!few(c.nonManifoldEdges)) out.push(`${c.nonManifoldEdges} edges shared by three or more triangles`);
  if (!few(c.flippedEdges)) out.push(`${c.flippedEdges} flipped edges (triangles facing opposite ways)`);
  if (!few(c.degenerate)) out.push(`${c.degenerate} empty triangles`);
  if (!few(c.openEdges)) out.push(`${c.openEdges} open edges (holes)`);
  return out;
}
