// Usage: npx tsx scripts/mesh-census.ts [file.glb ...]   (default: every GLB in public/assets/objects/)
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readGlbMesh } from '../src/slice/glb';
import { censusProblems, meshCensus } from '../src/slice/census';

const dir = 'public/assets/objects';
const files = process.argv.length > 2 ? process.argv.slice(2) : readdirSync(dir).filter((f) => f.endsWith('.glb')).map((f) => join(dir, f));
let bad = 0;
for (const f of files) {
  const buf = readFileSync(f);
  const c = meshCensus(readGlbMesh(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer));
  const problems = censusProblems(c);
  bad += problems.length ? 1 : 0;
  console.log(`${f}: ${c.size.map((s) => s.toFixed(2)).join(' x ')} m, ${c.triangles} triangles, open edges ${c.openEdges}, empty ${c.degenerate}${problems.length ? '\n  ' + problems.join('\n  ') : ' (ok)'}`);
}
process.exit(bad ? 1 : 0);
