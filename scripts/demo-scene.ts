// Makes a small demo scene (a bench, a dome, a low wall and a rounded block in a line, and a lone tower off to the side),
// writes it as a .glb, runs the slice search on it, and saves the best three lanes as courses you can open in the game:
//   npx tsx scripts/demo-scene.ts      then open  http://localhost:5173/?course=/assets/demo/lane-1.course.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { bestSlices, laneToCourse, type Mesh } from '../src/slice/slice';

const box = (x0: number, x1: number, y1: number, z0: number, z1: number): Mesh => ({
  positions: [x0, 0, z0, x1, 0, z0, x1, y1, z0, x0, y1, z0, x0, 0, z1, x1, 0, z1, x1, y1, z1, x0, y1, z1],
  indices: [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2],
});
const dome = (cx: number, rx: number, ry: number, rz: number, n = 28): Mesh => {
  const positions: number[] = [], indices: number[] = [];
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) { const th = (Math.PI / 2) * (i / n), ph = 2 * Math.PI * (j / n); positions.push(cx + rx * Math.sin(th) * Math.cos(ph), ry * Math.cos(th), rz * Math.sin(th) * Math.sin(ph)); }
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const a = i * (n + 1) + j, c = a + n + 1; indices.push(a, c, a + 1, a + 1, c, c + 1); }
  return { positions, indices };
};
const parts = [box(0, 3, 0.45, -0.7, 0.7), dome(7, 1.6, 0.85, 1), box(11, 13.5, 0.7, -0.8, 0.8), dome(17.5, 1.4, 0.6, 1), box(5, 8, 6, 6, 9)];
const positions: number[] = [], indices: number[] = [];
for (const m of parts) { const base = positions.length / 3; positions.push(...Array.from(m.positions)); indices.push(...Array.from(m.indices!).map((i) => i + base)); }

// the .glb (so the same file can be used with scripts/slice-glb.ts)
const pos = new Float32Array(positions), idx = new Uint32Array(indices);
const bin = new Uint8Array(pos.byteLength + idx.byteLength);
bin.set(new Uint8Array(pos.buffer), 0); bin.set(new Uint8Array(idx.buffer), pos.byteLength);
const json = JSON.stringify({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }], meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
  accessors: [{ bufferView: 0, componentType: 5126, count: positions.length / 3, type: 'VEC3' }, { bufferView: 1, componentType: 5125, count: indices.length, type: 'SCALAR' }],
  bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: pos.byteLength }, { buffer: 0, byteOffset: pos.byteLength, byteLength: idx.byteLength }], buffers: [{ byteLength: bin.length }] });
const jb = new TextEncoder().encode(json + ' '.repeat((4 - (json.length % 4)) % 4));
const total = 12 + 8 + jb.length + 8 + bin.length, out = new ArrayBuffer(total), dv = new DataView(out);
dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
dv.setUint32(12, jb.length, true); dv.setUint32(16, 0x4e4f534a, true); new Uint8Array(out, 20, jb.length).set(jb);
dv.setUint32(20 + jb.length, bin.length, true); dv.setUint32(24 + jb.length, 0x004e4942, true); new Uint8Array(out, 28 + jb.length, bin.length).set(bin);
mkdirSync('public/assets/demo', { recursive: true });
writeFileSync('public/assets/demo/demo-scene.glb', Buffer.from(out));

const best = bestSlices({ positions, indices }, { top: 3 });
best.forEach((c, i) => {
  const course = laneToCourse({ cells: [...c.profile.cells], length: c.profile.length }, `Demo lane ${i + 1}`);
  writeFileSync(`public/assets/demo/lane-${i + 1}.course.json`, JSON.stringify(course, null, 2) + '\n');
  const r = c.report;
  console.log(`lane ${i + 1}: turn ${Math.round((c.angle * 180) / Math.PI)} degrees, sideways ${c.offset.toFixed(1)} m: score ${r.score.toFixed(1)} (${r.gaps} gaps, ${r.steps} steps, ${r.curves} curves, ${r.faces} faces) -> /assets/demo/lane-${i + 1}.course.json`);
});
