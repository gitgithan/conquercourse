// CC-55: census and proportion check of the earlier SAM 3D Objects results (cc-38 rounds), the only object source with results so far.
// Usage: npx tsx scripts/bakeoff-census.ts > data/eval/object-bakeoff/sam3d-census.json
import { readFileSync } from 'node:fs';
import { readGlbMesh } from '../src/slice/glb';
import { censusProblems, meshCensus } from '../src/slice/census';

const eval_ = 'data/eval/cc-38-photo-to-3d', photos: { photo: string; label: string; box: number[] }[] = JSON.parse(readFileSync(`${eval_}/photos.json`, 'utf8'));
const rows = [];
for (const [round, names] of [['r2', ['park01', 'park02', 'park03', 'park06', 'park07']], ['r3', ['bench01', 'rail01', 'mural01', 'mural02']]] as const) {
  for (const name of names) {
    const p = photos.find((x) => x.photo === name)!, b = readFileSync(`${eval_}/${round}/${name}/mesh.glb`);
    const c = meshCensus(readGlbMesh(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer));
    const [x, y, z] = c.size, photoRatio = (p.box[2] - p.box[0]) / (p.box[3] - p.box[1]);
    rows.push({
      photo: name, label: p.label, round, size_m: c.size.map((s) => +s.toFixed(3)), triangles: c.triangles,
      openEdges: c.openEdges, nonManifoldEdges: c.nonManifoldEdges, flippedEdges: c.flippedEdges, empty: c.degenerate,
      widthOverHeight: +(Math.max(x, z) / y).toFixed(2), photoBoxWidthOverHeight: +photoRatio.toFixed(2), problems: censusProblems(c),
    });
  }
}
console.log(JSON.stringify(rows, null, 2));
