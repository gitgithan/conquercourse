// CC-179: does "the slicer says clearable" survive "Build the picked buildings" -> the editor's check?
// For ready places and cut heights: run the slicer's proved check (as slicer-worker.ts does), then rebuild the same lane the way the
// hand-over does (separate pieces, roleCourse, ideal run) with the level the old hand-over sent (real metres) and with the shrunk level.
// Usage: npx tsx scripts/slice-preview-vs-built.ts [slug...]   (writes data/eval/slice-ux/preview-vs-built.json)
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { bestSlices, surfaceSamples, laneSamples, sliceProfile } from '../src/slice/slice';
import { buildingTops, cutRange, piecesFrom } from '../src/world/../slice/slicer';
import { buildingsFrom, extrude } from '../src/world/osm';
import { newPiece } from '../src/slice/world';
import { roleCourse } from '../src/slice/roles';
import { searchIdealRun } from '../src/sim/ideal';
import type { Ground } from '../src/world/terrain';

const dir = 'public/assets/places/';
const slugs = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(dir).filter((f) => f.endsWith('.json') && !['index.json', 'photos-index.json'].includes(f)).map((f) => f.replace('.json', ''));
const K = Number(process.env.K ?? 0.2);
const out: Record<string, unknown>[] = [];
for (const slug of slugs) {
  const p = JSON.parse(readFileSync(dir + slug + '.json', 'utf8'));
  const ground: Ground | null = p.ground ? { radius: p.radius, ...p.ground } : null;
  const bs = buildingsFrom(p.answer, p.lat, p.lon), k = K;
  const tops = buildingTops(bs, k, ground), range = cutRange(tops, ground);
  const mesh = extrude(tops.map((t) => t.b), k, ground);
  const rows: Record<string, unknown>[] = [];
  for (const real of Array.from({ length: 6 }, (_, i) => Math.max(0.5, Math.round((range * (i + 0.5)) / 6 * 2) / 2))) {
    const level = real * k, samples = surfaceSamples({ positions: mesh.positions, indices: mesh.indices }, 80);
    const t0 = Date.now();
    const proved = bestSlices({ positions: samples }, { levels: [level], top: 1, centre: { x: 0, z: 0 }, maxProofs: 4, reprofile: (c) => sliceProfile(laneSamples({ positions: mesh.positions, indices: mesh.indices }, c), { x: 0, z: 0 }, c) })[0];
    const row: Record<string, unknown> = { realCut: real, level, previewCleared: !!proved, ms: Date.now() - t0 };
    if (proved) {
      const pieces = piecesFrom(tops, new Set(tops.keys()), k, ground).map((q) => ({ ...newPiece(q.name, { positions: q.positions, indices: q.indices }), x: q.x, z: q.z }));
      const built = (lv: number) => { const { course, length } = roleCourse(pieces, { angle: proved.angle, offset: proved.offset, level: lv }, 'built'); return length >= 8 && searchIdealRun(course).cleared; };
      row.builtSameLevel = built(level);
      row.builtOldHandover = built(real); // what the old hand-over sent: the real-metre cut as the editor's level
    }
    rows.push(row);
    console.log(slug, JSON.stringify(row));
  }
  out.push({ slug, k, range, rows });
}
mkdirSync('data/eval/slice-ux', { recursive: true });
writeFileSync(`data/eval/slice-ux/preview-vs-built${process.env.TAG ?? ''}.json`, JSON.stringify(out, null, 2) + '\n');
