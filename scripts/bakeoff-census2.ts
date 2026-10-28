// CC-55: census of the TRELLIS.2 and Pixal3D results next to the SAM 3D ones, after the same scale rule.
// Usage: npx tsx scripts/bakeoff-census2.ts > data/eval/object-bakeoff/open-models-census.json
// The models return meshes in a unit cube, so each is scaled so that its height (y) is the object's typical height from
// public/assets/objects/index.json (the rule the shipped SAM 3D objects used); width over height is then comparable.
import { existsSync, readFileSync } from 'node:fs';
import { readGlbMesh } from '../src/slice/glb';
import { censusProblems, meshCensus } from '../src/slice/census';

const dir = 'data/eval/object-bakeoff';
const objects: { name: string; photo: string; box: number[]; height_m: number }[] = JSON.parse(readFileSync('public/assets/objects/index.json', 'utf8')).objects;
const rows = [];
for (const model of ['trellis2', 'pixal3d']) {
  const meta = existsSync(`${dir}/outputs/${model}.json`) ? JSON.parse(readFileSync(`${dir}/outputs/${model}.json`, 'utf8')) : null;
  for (const o of objects) {
    const f = `${dir}/outputs/${model}-${o.name}.glb`;
    if (!existsSync(f)) { rows.push({ model, name: o.name, error: 'no result' }); continue; }
    try {
      const b = readFileSync(f), mesh = readGlbMesh(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
      const raw = meshCensus(mesh), k = o.height_m / (raw.size[1] || 1);
      const p = mesh.positions as ArrayLike<number>, scaled = Array.from({ length: p.length }, (_, i) => p[i] * k);
      const c = meshCensus({ positions: scaled, indices: mesh.indices });
      const [x, y, z] = c.size, [bx0, by0, bx1, by1] = o.box;
      rows.push({
        model, name: o.name, size_m: c.size.map((s) => +s.toFixed(3)), triangles: c.triangles, openEdges: c.openEdges, nonManifoldEdges: c.nonManifoldEdges,
        flippedEdges: c.flippedEdges, empty: c.degenerate, looseVertices: c.looseVertices,
        widthOverHeight: +(Math.max(x, z) / y).toFixed(2), photoBoxWidthOverHeight: +((bx1 - bx0) / (by1 - by0)).toFixed(2),
        seconds: meta?.objects?.[o.name]?.seconds ?? null, problems: censusProblems(c),
      });
    } catch (e) { rows.push({ model, name: o.name, error: String(e).slice(0, 160) }); }
  }
}
console.log(JSON.stringify(rows, null, 2));
