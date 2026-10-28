import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Static world geometry in few draws (CC-75): the decks, the pieces of a crowded course and a big city are merged into one mesh per
// material, and a mesh with many triangles is cut into chunks on a grid so the renderer can skip the chunks you cannot see.
// Looks only: collision comes from the simulator's terrain, never from these meshes.
export interface Part { geo: THREE.BufferGeometry; mat: THREE.Material }

// Position and normal only (the decks and pieces are plain colours), not indexed, so boxes, extrusions and raw meshes can be merged together.
const flat = (g: THREE.BufferGeometry): THREE.BufferGeometry => {
  const n = g.index ? g.toNonIndexed() : g.clone();
  for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
  n.clearGroups();
  return n;
};

export const triangleCount = (g: THREE.BufferGeometry): number => (g.index ? g.index.count : g.attributes.position.count) / 3;

export function mergeStatic(parts: Part[]): THREE.Mesh[] {
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  for (const { geo, mat } of parts) { const l = byMat.get(mat) ?? []; l.push(flat(geo)); byMat.set(mat, l); }
  const out: THREE.Mesh[] = [];
  for (const [mat, list] of byMat) {
    const merged = list.length === 1 ? list[0] : mergeGeometries(list, false);
    if (merged) out.push(new THREE.Mesh(merged, mat));
  }
  return out;
}

// Cut a non-indexed geometry into pieces by the grid cell its triangles' middles fall in (x along the run, z across it).
export function chunkGeometry(geo: THREE.BufferGeometry, cell: number): THREE.BufferGeometry[] {
  const pos = geo.attributes.position.array as ArrayLike<number>, nor = geo.attributes.normal?.array as ArrayLike<number> | undefined;
  const cells = new Map<string, { p: number[]; n: number[] }>();
  for (let t = 0; t + 8 < pos.length; t += 9) {
    const cx = Math.floor((pos[t] + pos[t + 3] + pos[t + 6]) / 3 / cell), cz = Math.floor((pos[t + 2] + pos[t + 5] + pos[t + 8]) / 3 / cell), key = `${cx},${cz}`;
    let c = cells.get(key); if (!c) { c = { p: [], n: [] }; cells.set(key, c); }
    for (let k = 0; k < 9; k++) { c.p.push(pos[t + k]); if (nor) c.n.push(nor[t + k]); }
  }
  return [...cells.values()].map((c) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(c.p, 3));
    if (nor) g.setAttribute('normal', new THREE.Float32BufferAttribute(c.n, 3));
    g.computeBoundingSphere();
    return g;
  });
}

// Big meshes become chunks; small ones stay one mesh.
export const CHUNK_OVER = 20000; // triangles
export const CHUNK_CELL = 64; // m
export function chunked(meshes: THREE.Mesh[]): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  for (const m of meshes) {
    if (triangleCount(m.geometry) <= CHUNK_OVER) { m.geometry.computeBoundingSphere(); out.push(m); continue; }
    for (const g of chunkGeometry(m.geometry, CHUNK_CELL)) out.push(new THREE.Mesh(g, m.material));
    m.geometry.dispose();
  }
  return out;
}

// Distance level of detail, the simple kind: a chunk far from the camera is not drawn at all. Call once a frame when there are many chunks.
export function cullFar(chunks: THREE.Mesh[], from: THREE.Vector3, range: number): void {
  for (const m of chunks) {
    const s = m.geometry.boundingSphere;
    m.visible = !s || from.distanceTo(s.center) - s.radius < range;
  }
}
