import type { Mesh } from './slice';

// A small reader for .glb files: the triangles of every mesh, with each node's translation and scale applied (no rotations, no skins).
// Enough for the baked game assets this project makes; anything fancier should be baked flat first.
const COMPONENT: Record<number, { size: number; read: (v: DataView, at: number) => number }> = {
  5121: { size: 1, read: (v, at) => v.getUint8(at) },
  5123: { size: 2, read: (v, at) => v.getUint16(at, true) },
  5125: { size: 4, read: (v, at) => v.getUint32(at, true) },
  5126: { size: 4, read: (v, at) => v.getFloat32(at, true) },
};
const WIDTH: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

interface Gltf {
  accessors: { bufferView: number; byteOffset?: number; componentType: number; count: number; type: string }[];
  bufferViews: { byteOffset?: number; byteStride?: number }[];
  meshes: { primitives: { attributes: { POSITION: number }; indices?: number }[] }[];
  nodes?: { mesh?: number; translation?: number[]; scale?: number[]; children?: number[] }[];
  scenes?: { nodes: number[] }[];
}

export function readGlbMesh(buf: ArrayBuffer): Mesh {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('not a .glb file');
  let json: Gltf | null = null, bin = 0;
  for (let at = 12; at < dv.byteLength;) {
    const len = dv.getUint32(at, true), type = dv.getUint32(at + 4, true);
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, at + 8, len)));
    else if (type === 0x004e4942) bin = at + 8;
    at += 8 + len + ((4 - (len % 4)) % 4);
  }
  if (!json) throw new Error('no JSON chunk');
  const g = json;
  const read = (acc: number): number[] => {
    const a = g.accessors[acc], bv = g.bufferViews[a.bufferView], c = COMPONENT[a.componentType], w = WIDTH[a.type];
    const stride = bv.byteStride ?? c.size * w, base = bin + (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const out: number[] = [];
    for (let i = 0; i < a.count; i++) for (let k = 0; k < w; k++) out.push(c.read(dv, base + i * stride + k * c.size));
    return out;
  };
  const positions: number[] = [], indices: number[] = [];
  const place = (node: number, tx: number, ty: number, tz: number, sx: number, sy: number, sz: number) => {
    const n = g.nodes?.[node];
    if (!n) return;
    const [nx, ny, nz] = n.translation ?? [0, 0, 0], [mx, my, mz] = n.scale ?? [1, 1, 1];
    const T = [tx + nx * sx, ty + ny * sy, tz + nz * sz], S = [sx * mx, sy * my, sz * mz];
    if (n.mesh !== undefined) for (const prim of g.meshes[n.mesh].primitives) {
      const base = positions.length / 3, p = read(prim.attributes.POSITION);
      for (let i = 0; i < p.length; i += 3) positions.push(T[0] + p[i] * S[0], T[1] + p[i + 1] * S[1], T[2] + p[i + 2] * S[2]);
      if (prim.indices !== undefined) for (const i of read(prim.indices)) indices.push(base + i);
      else for (let i = 0; i < p.length / 3; i++) indices.push(base + i);
    }
    for (const c of n.children ?? []) place(c, T[0], T[1], T[2], S[0], S[1], S[2]);
  };
  const roots = g.scenes?.[0]?.nodes ?? (g.nodes ?? []).map((_, i) => i);
  for (const r of roots) place(r, 0, 0, 0, 1, 1, 1);
  return { positions, indices };
}
