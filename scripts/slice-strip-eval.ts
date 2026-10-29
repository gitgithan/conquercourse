// CC-202: is a green "try a height" really a path? For each place, make the strip of 10 heights the way the page does (shape only),
// then run the full simulator proof at every height and count the greens that give no path.
// Usage: npx tsx scripts/slice-strip-eval.ts <slug...>   (env SHRINK=0.2)   Writes data/eval/slice-ux2/strip-<slug>.json
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { buildingTops, cutRange, piecesFrom } from '../src/slice/slicer';
import { buildingsFrom, extrude } from '../src/world/osm';
import { pathAt, stripRows } from '../src/slice/slicer-core';
import type { Ground } from '../src/world/terrain';

const k = Number(process.env.SHRINK ?? 0.2);
mkdirSync('data/eval/slice-ux2', { recursive: true });
for (const slug of process.argv.slice(2)) {
  const p = JSON.parse(readFileSync(`public/assets/places/${slug}.json`, 'utf8'));
  const ground: Ground | null = p.ground ? { radius: p.radius, ...p.ground } : null;
  const tops = buildingTops(buildingsFrom(p.answer, p.lat, p.lon), k, ground), all = new Set(tops.keys());
  const m = extrude(tops.map((t) => t.b), k, ground), place = { mesh: { positions: m.positions, indices: m.indices }, pieces: piecesFrom(tops, all, k, ground) };
  const range = cutRange(tops, ground);
  const reals = Array.from({ length: 10 }, (_, i) => Math.max(0.5, Math.round((range * (i + 0.5)) / 10 * 2) / 2));
  const shape = stripRows(place.mesh, reals.map((c) => c * k));
  const t0 = Date.now();
  const rows = reals.map((real, i) => ({ real, lane: shape[i].lane, oldGreen: !!shape[i].crossable, path: pathAt(place, real * k) }));
  const oldGreen = rows.filter((r) => r.oldGreen).length, oldGreenNoPath = rows.filter((r) => r.oldGreen && !r.path).length;
  const out = { slug, shrink: k, range, oldGreen, oldGreenNoPath, newGreenNoPath: 0, pathCount: rows.filter((r) => r.path).length, seconds: Math.round((Date.now() - t0) / 100) / 10, rows };
  writeFileSync(`data/eval/slice-ux2/strip-${slug}.json`, JSON.stringify(out, null, 2) + '\n');
  console.log(slug, `old green ${oldGreen}, of them no path ${oldGreenNoPath}, paths ${out.pathCount}/10, ${out.seconds}s`);
}
