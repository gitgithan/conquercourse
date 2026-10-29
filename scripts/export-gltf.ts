// Export a course's blocks to a binary glTF (.glb) so Blender (or any 3D tool) can light and render it (CC-188).
// Usage: npx tsx scripts/export-gltf.ts <course.json> <out.glb>
// Mirrors the shapes src/modes/course.ts draws: decks as boxes 2 m deep, the warped wall, the rope and its beam, planks, holds.
// Units are metres, x along the run, y up, z across the lane (glTF is y-up, so no axis change is needed).
import { readFileSync, writeFileSync } from 'node:fs';

type V3 = [number, number, number];
interface Mat { name: string; color: [number, number, number, number]; rough: number; emissive?: [number, number, number]; }
const MATS: Record<string, Mat> = {
  grass: { name: 'grass', color: [0.478, 0.663, 0.361, 1], rough: 0.9 },
  stone: { name: 'stone', color: [0.725, 0.698, 0.639, 1], rough: 0.85 },
  bed: { name: 'trampoline', color: [0.851, 0.271, 0.227, 1], rough: 0.6 },
  wall: { name: 'wall', color: [0.788, 0.537, 0.231, 1], rough: 0.7 },
  rope: { name: 'rope', color: [0.541, 0.353, 0.169, 1], rough: 0.9 },
  wood: { name: 'wood', color: [0.62, 0.45, 0.25, 1], rough: 0.8 },
  hold: { name: 'hold', color: [0.95, 0.75, 0.15, 1], rough: 0.5 },
  lava: { name: 'lava', color: [1.0, 0.25, 0.05, 1], rough: 0.5, emissive: [1.0, 0.3, 0.05] },
};
const parts = new Map<string, { pos: number[]; nor: number[]; idx: number[] }>();
const part = (m: string) => { let p = parts.get(m); if (!p) { p = { pos: [], nor: [], idx: [] }; parts.set(m, p); } return p; };

// one flat-shaded quad (four corners, counter-clockwise seen from outside)
function quad(m: string, a: V3, b: V3, c: V3, d: V3) {
  const p = part(m), base = p.pos.length / 3;
  const u: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v: V3 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
  let n: V3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const l = Math.hypot(...n) || 1; n = [n[0] / l, n[1] / l, n[2] / l];
  for (const q of [a, b, c, d]) { p.pos.push(...q); p.nor.push(...n); }
  p.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}
function box(m: string, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
  quad(m, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]); // front
  quad(m, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]); // back
  quad(m, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]); // top
  quad(m, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]); // bottom
  quad(m, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]); // right
  quad(m, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]); // left
}
// a convex-ish side profile (x,y points) pushed across the lane; fan-triangulated from the first point (the wall's quarter curve is star-shaped from (H,0))
function extrude(m: string, pts: [number, number][], z0: number, z1: number, ox: number) {
  const pr = part(m);
  const add = (a: V3, b: V3, c: V3, n: V3) => { const base = pr.pos.length / 3; for (const q of [a, b, c]) { pr.pos.push(...q); pr.nor.push(...n); } pr.idx.push(base, base + 1, base + 2); };
  const c = pts[pts.length - 1]; // the fan centre is the last point
  for (let i = 0; i < pts.length - 2; i++) {
    const a = pts[i], b = pts[i + 1];
    add([ox + c[0], c[1], z1], [ox + a[0], a[1], z1], [ox + b[0], b[1], z1], [0, 0, 1]);
    add([ox + c[0], c[1], z0], [ox + b[0], b[1], z0], [ox + a[0], a[1], z0], [0, 0, -1]);
  }
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    if (a[0] === b[0] && a[1] === b[1]) continue;
    quad(m, [ox + b[0], b[1], z1], [ox + a[0], a[1], z1], [ox + a[0], a[1], z0], [ox + b[0], b[1], z0]);
  }
}
function cylinder(m: string, x: number, yTop: number, yBot: number, r: number, n = 10) {
  for (let i = 0; i < n; i++) {
    const t0 = (i / n) * Math.PI * 2, t1 = ((i + 1) / n) * Math.PI * 2;
    quad(m, [x + r * Math.cos(t0), yBot, r * Math.sin(t0)], [x + r * Math.cos(t1), yBot, r * Math.sin(t1)], [x + r * Math.cos(t1), yTop, r * Math.sin(t1)], [x + r * Math.cos(t0), yTop, r * Math.sin(t0)]);
  }
}

const [, , src, out] = process.argv;
if (!src || !out) { console.error('usage: tsx scripts/export-gltf.ts <course.json> <out.glb>'); process.exit(1); }
const course = JSON.parse(readFileSync(src, 'utf8'));
const D = 1; // half of the 2 m lane depth
const waterY: number = course.terrain.waterY;
for (const p of course.terrain.platforms) {
  if (p.coasterRail || p.profile) continue; // curved or rail decks are not needed for the stills
  box(p.bouncy ? 'bed' : p.top === 0 ? 'grass' : 'stone', p.x0, p.x1, waterY - 2, p.top, -D, D);
}
if (course.wall) {
  const H: number = course.wall.height ?? 4;
  const pts: [number, number][] = [[0, 0]];
  for (let i = 0; i <= 24; i++) { const th = (i / 24) * (Math.PI / 2); pts.push([H * Math.sin(th), H * (1 - Math.cos(th))]); }
  pts.push([H, 0]);
  extrude('wall', pts, -D, D, course.wall.x0);
}
if (course.rope) {
  const len: number = course.rope.length ?? 9;
  cylinder('rope', course.rope.anchorX, course.rope.anchorY, course.rope.anchorY - len, 0.06);
  box('stone', course.rope.anchorX - 0.2, course.rope.anchorX + 0.2, course.rope.anchorY, course.rope.anchorY + 0.4, -D, D);
}
for (const pl of course.planks ?? []) box('wood', pl.x0, pl.x1, pl.y - (pl.thickness ?? 0.05), pl.y, -(pl.width ?? 0.6) / 2, (pl.width ?? 0.6) / 2);
for (const h of course.holds ?? []) box('hold', h.x - 0.4, h.x + 0.4, h.y - 0.04, h.y + 0.04, -0.15, 0.15); // a bar the hands catch
// the hazard floor below the decks, as a wide thin slab
box('lava', course.startX - 200, course.finishX + 200, waterY - 0.2, waterY, -150, 150);

// glTF assembly: one buffer, one mesh primitive per material
const names = [...parts.keys()];
const chunks: Buffer[] = [];
const bufferViews: object[] = [], accessors: object[] = [], primitives: object[] = [], materials: object[] = [];
let off = 0;
const pushView = (buf: Buffer, target: number) => { bufferViews.push({ buffer: 0, byteOffset: off, byteLength: buf.length, target }); chunks.push(buf); off += buf.length; return bufferViews.length - 1; };
names.forEach((nm, i) => {
  const p = parts.get(nm)!, m = MATS[nm];
  const pos = Buffer.from(new Float32Array(p.pos).buffer), nor = Buffer.from(new Float32Array(p.nor).buffer), idx = Buffer.from(new Uint32Array(p.idx).buffer);
  const xs = p.pos.filter((_, k) => k % 3 === 0), ys = p.pos.filter((_, k) => k % 3 === 1), zs = p.pos.filter((_, k) => k % 3 === 2);
  const a0 = accessors.length;
  accessors.push({ bufferView: pushView(pos, 34962), componentType: 5126, count: p.pos.length / 3, type: 'VEC3', min: [Math.min(...xs), Math.min(...ys), Math.min(...zs)], max: [Math.max(...xs), Math.max(...ys), Math.max(...zs)] });
  accessors.push({ bufferView: pushView(nor, 34962), componentType: 5126, count: p.nor.length / 3, type: 'VEC3' });
  accessors.push({ bufferView: pushView(idx, 34963), componentType: 5125, count: p.idx.length, type: 'SCALAR' });
  materials.push({ name: m.name, pbrMetallicRoughness: { baseColorFactor: m.color, metallicFactor: 0, roughnessFactor: m.rough }, ...(m.emissive ? { emissiveFactor: m.emissive } : {}) });
  primitives.push({ attributes: { POSITION: a0, NORMAL: a0 + 1 }, indices: a0 + 2, material: i });
});
const bin = Buffer.concat(chunks);
const json = { asset: { version: '2.0', generator: 'conquercourse scripts/export-gltf.ts' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: course.name ?? 'course', mesh: 0 }], meshes: [{ name: 'course', primitives }], materials, accessors, bufferViews, buffers: [{ byteLength: bin.length }] };
const pad = (b: Buffer, ch: number) => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4, ch)]);
const js = pad(Buffer.from(JSON.stringify(json)), 0x20), bn = pad(bin, 0);
const hdr = Buffer.alloc(12); hdr.write('glTF', 0); hdr.writeUInt32LE(2, 4); hdr.writeUInt32LE(12 + 8 + js.length + 8 + bn.length, 8);
const ch = (len: number, type: string) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.write(type, 4, 'latin1'); return b; };
writeFileSync(out, Buffer.concat([hdr, ch(js.length, 'JSON'), js, ch(bn.length, 'BIN\0'), bn]));
console.log(`${out}: ${names.length} materials, ${[...parts.values()].reduce((s, p) => s + p.idx.length / 3, 0)} triangles`);
