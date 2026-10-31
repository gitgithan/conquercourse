// Reads the skin of a character glb (positions, bone indices, weights, triangles, bone names and rest positions) without a renderer,
// so the tests and the checking scripts can run the same fit the game runs at load. Handles the glbs our maker writes (float or int accessors, one mesh, one skin).
import { Matrix4 } from 'three';
import { readGlb } from './limits';
import type { FitInput, Vec3 } from './fit';

type Acc = { count: number; type: string; componentType: number; bufferView: number; byteOffset?: number };
const SIZE: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

export function readSkin(bytes: Uint8Array): FitInput | null {
  const g = readGlb(bytes);
  if (!g) return null;
  const j = g.json as unknown as { nodes: { name?: string }[]; skins: { joints: number[]; inverseBindMatrices: number }[]; meshes: { primitives: { indices: number; attributes: Record<string, number> }[] }[]; accessors: Acc[]; bufferViews: { byteOffset?: number; byteLength: number; byteStride?: number }[] };
  const bin = g.bin;
  const read = (i: number): Float64Array => {
    const a = j.accessors[i], bv = j.bufferViews[a.bufferView], n = SIZE[a.type];
    const dv = new DataView(bin.buffer, bin.byteOffset + (bv.byteOffset ?? 0) + (a.byteOffset ?? 0));
    const bytesPer = { 5126: 4, 5125: 4, 5123: 2, 5121: 1 }[a.componentType]!;
    const stride = bv.byteStride ?? n * bytesPer, out = new Float64Array(a.count * n);
    for (let r = 0; r < a.count; r++) for (let c = 0; c < n; c++) {
      const at = r * stride + c * bytesPer;
      out[r * n + c] = a.componentType === 5126 ? dv.getFloat32(at, true) : a.componentType === 5125 ? dv.getUint32(at, true) : a.componentType === 5123 ? dv.getUint16(at, true) : dv.getUint8(at);
    }
    return out;
  };
  const p = j.meshes[0].primitives[0], skin = j.skins[0];
  const ibm = read(skin.inverseBindMatrices);
  const rest: Vec3[] = skin.joints.map((_, i) => {
    const t = new Matrix4().fromArray(Array.from(ibm.subarray(i * 16, i * 16 + 16))).invert().elements;
    return [t[12], t[13], t[14]];
  });
  return {
    positions: Float32Array.from(read(p.attributes.POSITION)),
    joints: read(p.attributes.JOINTS_0),
    weights: read(p.attributes.WEIGHTS_0),
    index: read(p.indices),
    names: skin.joints.map((n) => j.nodes[n].name ?? ''),
    rest,
  };
}
