// Builds a tiny valid character glb for tests: 34 joints, one mesh, one texture of a chosen size.
export function glb(o: { bones?: number; faces?: number; tex?: number; animations?: boolean; pad?: number } = {}): Uint8Array {
  const bones = o.bones ?? 34, faces = o.faces ?? 100, tex = o.tex ?? 256;
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, tex >> 8, tex & 255, tex >> 8, tex & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0xff, 0xd9]);
  const bin = new Uint8Array(jpeg.length + (o.pad ?? 0) + 4); bin.set(jpeg);
  const j = {
    asset: { version: '2.0' },
    nodes: Array.from({ length: bones }, (_, i) => ({ name: `bone${i}` })),
    skins: [{ joints: Array.from({ length: bones }, (_, i) => i) }],
    meshes: [{ primitives: [{ indices: 0, attributes: { POSITION: 1 } }] }],
    accessors: [{ count: faces * 3 }, { count: faces * 2 }],
    images: [{ bufferView: 0 }],
    bufferViews: [{ byteOffset: 0, byteLength: jpeg.length }],
    ...(o.animations ? { animations: [{}] } : {}),
  };
  let js = JSON.stringify(j); while (js.length % 4) js += ' ';
  const jb = new TextEncoder().encode(js);
  const out = new Uint8Array(20 + jb.length + 8 + bin.length);
  const dv = new DataView(out.buffer);
  out.set([0x67, 0x6c, 0x54, 0x46]); dv.setUint32(4, 2, true); dv.setUint32(8, out.length, true);
  dv.setUint32(12, jb.length, true); out.set([0x4a, 0x53, 0x4f, 0x4e], 16); out.set(jb, 20);
  dv.setUint32(20 + jb.length, bin.length, true); out.set([0x42, 0x49, 0x4e, 0], 24 + jb.length); out.set(bin, 28 + jb.length);
  return out;
}
export const thumb = (): Uint8Array => { const t = new Uint8Array(60); t.set([82, 73, 70, 70], 0); t.set([87, 69, 66, 80], 8); return t; };
