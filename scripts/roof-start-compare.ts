// CC-200: does starting on the first roof (and hiding all below the cut) make more cut heights solvable? (owner idea, 2026-11-01)
// Usage: npx tsx scripts/roof-start-compare.ts --slug shibuya-tokyo [--out file.json] [--step 0.5]
// For one place at the shrink stored with it: at every cut height, the Slicer's own lane search with the simulator proof (provedLane), with the switch off and on.
// Heavy: run it on a VM, one process per place.
import { readFileSync, writeFileSync } from 'node:fs';
import type { ReadyPlace } from '../src/world/places';
import { provedLane } from '../src/slice/slicer-core';
import { stateAt, type PlaceInput } from '../src/slice/slicer-default';
import { setRoofStart } from '../src/slice/slice';

const args = process.argv.slice(2), arg = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const slug = arg('--slug'); if (!slug) throw new Error('--slug needed');
const step = Number(arg('--step') ?? 0.5), dir = 'public/assets/places';
const pl = JSON.parse(readFileSync(`${dir}/${slug}.json`, 'utf8')) as ReadyPlace;
const p: PlaceInput = { answer: pl.answer, lat: pl.lat, lon: pl.lon, ground: pl.ground ? { radius: pl.radius, ...pl.ground } : null };
const k = pl.lane?.shrink ?? 0.4, st = stateAt(p, k), place = { mesh: st.mesh, pieces: st.pieces };
const rows: { cut: number; off: boolean; on: boolean }[] = [];
for (let c = step; c <= st.range; c += step) {
  const res = { cut: c, off: false, on: false };
  for (const mode of [false, true]) {
    setRoofStart(mode);
    let ok = false; try { ok = !!provedLane(place, c * k); } catch { ok = false; }
    if (mode) res.on = ok; else res.off = ok;
  }
  setRoofStart(false);
  rows.push(res); console.error(`${slug} cut ${c}: off ${res.off} on ${res.on}`);
}
const sum = { slug, shrink: k, range: st.range, heights: rows.length, solvableOff: rows.filter((r) => r.off).length, solvableOn: rows.filter((r) => r.on).length, onlyOn: rows.filter((r) => r.on && !r.off).length, onlyOff: rows.filter((r) => r.off && !r.on).length, rows };
writeFileSync(arg('--out') ?? `/tmp/roof-${slug}.json`, JSON.stringify(sum, null, 2) + '\n');
console.error(`== ${slug}: solvable heights off ${sum.solvableOff} on ${sum.solvableOn} of ${sum.heights}`);
