// CC-179, after the fix: the preview proof reads the lane from the editor's pieces and the hand-over sends the shrunk level.
// Usage: npx tsx scripts/slice-preview-vs-built-after.ts <slug>   (writes data/eval/slice-ux/after/<slug>.json)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { buildingTops, cutRange, handoverLane, piecesFrom } from '../src/slice/slicer';
import { buildingsFrom, extrude } from '../src/world/osm';
import { provedLane, worldOf } from '../src/slice/slicer-core';
import { roleCourse } from '../src/slice/roles';
import { searchIdealRun } from '../src/sim/ideal';
import type { Ground } from '../src/world/terrain';

const K = Number(process.env.K ?? 0.2);
for (const slug of process.argv.slice(2)) {
  const p = JSON.parse(readFileSync(`public/assets/places/${slug}.json`, 'utf8'));
  const ground: Ground | null = p.ground ? { radius: p.radius, ...p.ground } : null;
  const tops = buildingTops(buildingsFrom(p.answer, p.lat, p.lon), K, ground), range = cutRange(tops, ground);
  const m = extrude(tops.map((t) => t.b), K, ground), pieces = piecesFrom(tops, new Set(tops.keys()), K, ground);
  const rows: Record<string, unknown>[] = [];
  for (const real of Array.from({ length: 6 }, (_, i) => Math.max(0.5, Math.round((range * (i + 0.5)) / 6 * 2) / 2))) {
    const lane = provedLane({ mesh: { positions: m.positions, indices: m.indices }, pieces }, real * K);
    const row: Record<string, unknown> = { realCut: real, previewCleared: !!lane };
    if (lane) { const { course, length } = roleCourse(worldOf(pieces), handoverLane(lane, real, K), 'built'); row.builtCleared = length >= 8 && searchIdealRun(course).cleared; }
    rows.push(row); console.log(slug, JSON.stringify(row));
  }
  mkdirSync('data/eval/slice-ux/after', { recursive: true });
  writeFileSync(`data/eval/slice-ux/after/${slug}.json`, JSON.stringify({ slug, k: K, range, rows }, null, 2) + '\n');
}
