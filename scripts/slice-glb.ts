// Finds the most interesting lanes in a .glb scene: turns it about a vertical rod, steps sideways, tries levels,
// and prints the best three lanes (with a sketch of each) and writes their courses.
// Usage: npx tsx scripts/slice-glb.ts path/to/scene.glb [outdir]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { readGlbMesh } from '../src/slice/glb';
import { bestSlices, laneToCourse } from '../src/slice/slice';

const [file, out = 'test-results/slices'] = process.argv.slice(2);
if (!file) { console.error('Usage: npx tsx scripts/slice-glb.ts scene.glb [outdir]'); process.exit(1); }
const buf = readFileSync(file);
const mesh = readGlbMesh(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
console.log(`${mesh.positions.length / 3} vertices, ${(mesh.indices?.length ?? 0) / 3} triangles`);
mkdirSync(out, { recursive: true });
const best = bestSlices(mesh, { top: 3 });
if (!best.length) console.log('No lane the runner can clear was found.');
best.forEach((c, i) => {
  const r = c.report;
  console.log(`#${i + 1}: turn ${Math.round((c.angle * 180) / Math.PI)} degrees, sideways ${c.offset.toFixed(1)} m, level ${c.level.toFixed(2)} m: score ${r.score.toFixed(1)} (${r.gaps} gaps, ${r.steps} steps, ${r.curves} curves, ${r.faces} faces, ${r.length.toFixed(1)} m)`);
  const w = 600, h = 140, sx = w / Math.max(1, c.profile.length), sy = 22;
  const pts = c.profile.cells.map((v, k) => (v === null ? null : `${(k * 0.1 * sx).toFixed(1)},${(h - 10 - v * sy).toFixed(1)}`));
  const d = pts.reduce<string>((acc, p, k) => (p === null ? acc : `${acc}${pts[k - 1] == null ? 'M' : 'L'}${p} `), '');
  writeFileSync(`${out}/lane-${i + 1}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#dfeaf5"/><path d="${d}" fill="none" stroke="#17201d" stroke-width="3"/></svg>`);
  writeFileSync(`${out}/lane-${i + 1}.course.json`, JSON.stringify(laneToCourse({ cells: [...c.profile.cells], length: c.profile.length }, `Slice ${i + 1}`), null, 2) + '\n');
});
