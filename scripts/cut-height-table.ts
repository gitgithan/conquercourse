// CC-92: does a lower cut height help the simulator, and are the gaps between buildings too wide?
// For every ready place and a ladder of cut heights, take the best lane by shape (no simulator proof) and write its facts.
// Usage: npx tsx scripts/cut-height-table.ts [slug...]   (writes data/eval/cc-92-why/cut-heights.json)
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { bestSlices, surfaceSamples } from '../src/slice/slice';
import { laneFacts, looksCrossable } from '../src/slice/why';
import { osmToMesh } from '../src/world/osm';
import type { Ground } from '../src/world/terrain';

const dir = 'public/assets/places/';
const slugs = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(dir).filter((f) => f.endsWith('.json') && !['index.json', 'photos-index.json'].includes(f)).map((f) => f.replace('.json', ''));
const LEVELS = [0.5, 1, 2, 3, 4, 6, 8, 12, 16];
const r1 = (v: number) => Math.round(v * 10) / 10;
const out: Record<string, unknown>[] = [];
for (const slug of slugs) {
  const p = JSON.parse(readFileSync(dir + slug + '.json', 'utf8'));
  const ground: Ground | null = p.ground ? { radius: p.radius, ...p.ground } : null;
  const k: number = p.lane.shrink, m = osmToMesh(p.answer, p.lat, p.lon, k, ground);
  const samples = surfaceSamples({ positions: m.positions, indices: m.indices }, 20);
  const rows = LEVELS.map((level) => {
    const found = bestSlices({ positions: samples }, { levels: [level], top: 8, prove: false, centre: { x: 0, z: 0 } });
    if (!found.length) return { level, lane: false };
    let pick = laneFacts(found[0].profile), ok = looksCrossable(pick);
    for (const c of found) { const f = laneFacts(c.profile), good = looksCrossable(f); if (good && !ok) { pick = f; ok = true; } if (ok) break; }
    const f = pick;
    return { level, lane: true, lengthM: r1(f.lengthM), widestGapM: r1(f.widestGapM), widestGapRealM: r1(f.widestGapM / k), tallestStepM: r1(f.tallestStepM), deepestDropM: r1(f.deepestDropM), solidPct: Math.round(f.solidShare * 100), needsSpeed: Number.isFinite(f.needsSpeed) ? r1(f.needsSpeed) : 999, hardGapM: r1(f.hardGapM), hardRiseM: r1(f.hardRiseM), looksCrossable: ok };
  });
  out.push({ slug, shrink: k, storedLane: { levelM: p.lane.levelM, lengthM: p.lane.lengthM }, rows });
  console.log(slug.padEnd(30), 'k', k, rows.map((r) => ('lengthM' in r ? `${r.level}:${r.widestGapM}m${r.looksCrossable ? '+' : '-'}` : `${r.level}:none`)).join('  '));
}
mkdirSync('data/eval/cc-92-why', { recursive: true });
writeFileSync('data/eval/cc-92-why/cut-heights.json', JSON.stringify(out, null, 2) + '\n');
