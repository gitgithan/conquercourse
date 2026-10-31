// The size caps for a stored character and the check that enforces them (CC-108). The same numbers live in pipelines/charmaker/limits.py;
// tests/characters-limits.test.ts reads that file and keeps the two equal. Pure: works on bytes, so the server and the tests share it.
export const MAX_FACES = 3200; // the build asks for 3,000
export const MAX_VERTS = 6000;
export const MAX_TEXTURE_PX = 256;
export const MAX_GLB_BYTES = 240_000; // a 3,000-face, 256 px character weighs about 210 KB
export const MAX_THUMB_BYTES = 8_000;
export const BONES = 34;

interface Gltf { nodes: { name?: string }[]; skins?: { joints: number[] }[]; meshes?: { primitives: { indices: number; attributes: Record<string, number> }[] }[]; accessors: { count: number }[]; images?: { bufferView: number }[]; bufferViews: { byteOffset?: number; byteLength: number }[]; animations?: unknown[] }

export function readGlb(b: Uint8Array): { json: Gltf; bin: Uint8Array } | null {
  if (b.length < 28 || String.fromCharCode(b[0], b[1], b[2], b[3]) !== 'glTF') return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const jl = dv.getUint32(12, true);
  if (20 + jl + 8 > b.length) return null;
  let json: Gltf;
  try { json = JSON.parse(new TextDecoder().decode(b.subarray(20, 20 + jl))) as Gltf; } catch { return null; }
  const bl = dv.getUint32(20 + jl, true);
  return { json, bin: b.subarray(28 + jl, 28 + jl + bl) };
}

/** [width, height] of a jpeg or png, or null. */
export function imageSize(d: Uint8Array): [number, number] | null {
  if (d[0] === 0xff && d[1] === 0xd8) {
    let i = 2;
    while (i + 9 < d.length) {
      if (d[i] !== 0xff) { i++; continue; }
      const m = d[i + 1];
      if (m === 0xc0 || m === 0xc1 || m === 0xc2) return [(d[i + 7] << 8) | d[i + 8], (d[i + 5] << 8) | d[i + 6]];
      i += 2 + ((d[i + 2] << 8) | d[i + 3]);
    }
    return null;
  }
  if (d[0] === 0x89 && d[1] === 0x50 && d[2] === 0x4e && d[3] === 0x47) {
    const dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
    return [dv.getUint32(16), dv.getUint32(20)];
  }
  return null;
}

/** Every reason a character glb is refused (empty list: fine). `bones`: the Rookie's 34 names, when the caller has them. */
export function glbProblems(b: Uint8Array, bones?: string[]): string[] {
  const out: string[] = [];
  if (b.length > MAX_GLB_BYTES) out.push(`file is ${b.length} bytes, the limit is ${MAX_GLB_BYTES}`);
  const g = readGlb(b);
  if (!g) return [...out, 'not a readable glb'];
  const j = g.json;
  if (j.animations?.length) out.push('has animations');
  if (!j.skins || j.skins.length !== 1) out.push('needs exactly one skin');
  else {
    const joints = j.skins[0].joints;
    if (joints.length !== BONES) out.push(`has ${joints.length} bones, needs ${BONES}`);
    if (bones && JSON.stringify(joints.map((n) => j.nodes[n]?.name)) !== JSON.stringify(bones)) out.push("bone names differ from the Rookie's");
  }
  if (!j.meshes || j.meshes.length !== 1 || j.meshes[0].primitives.length !== 1) out.push('needs exactly one mesh with one primitive');
  else {
    const p = j.meshes[0].primitives[0];
    const faces = j.accessors[p.indices].count / 3, verts = j.accessors[p.attributes.POSITION].count;
    if (faces > MAX_FACES) out.push(`${faces} faces, the limit is ${MAX_FACES}`);
    if (verts > MAX_VERTS) out.push(`${verts} vertices, the limit is ${MAX_VERTS}`);
  }
  if (!j.images || j.images.length !== 1) out.push('needs exactly one texture');
  else {
    const bv = j.bufferViews[j.images[0].bufferView], at = bv.byteOffset ?? 0;
    const size = imageSize(g.bin.subarray(at, at + bv.byteLength));
    if (!size) out.push('texture is not a jpeg or png');
    else if (Math.max(...size) > MAX_TEXTURE_PX) out.push(`texture is ${size[0]} x ${size[1]}, the limit is ${MAX_TEXTURE_PX}`);
  }
  return out;
}

export const THUMB_OK = (b: Uint8Array): boolean => b.length > 12 && b.length <= MAX_THUMB_BYTES && String.fromCharCode(...b.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...b.subarray(8, 12)) === 'WEBP';
