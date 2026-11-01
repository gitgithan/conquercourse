// CC-90: find, for every prepared place, the Slicer's best default (shrink, cut height, line) that the real simulator proves clearable.
// Usage: npx tsx scripts/slicer-defaults.ts [--slug a,b] [--out file] [--budget-s 600]
// For each place: (1) try the lane stored with the place, in the Slicer's frame; (2) else search shrinks and cut heights with the Slicer's own lane search;
// every answer is replayed with replayDefault (the same check the live Slicer runs on a player's line) before it is stored.
// Run on the VM: it is heavy. Writes public/assets/places/slicer-defaults.json (pretty-printed).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import type { ReadyPlace } from '../src/world/places';
import { provedLane, quickLane } from '../src/slice/slicer-core';
import { CHECK_VERSION, replayDefault, stateAt, type DefaultsFile, type Line, type PlaceInput, type SlicerDefault } from '../src/slice/slicer-default';
import { laneLine } from '../src/slice/slicer';
import { shrinkLadder } from '../src/world/place-lane';
import { buildingsFrom } from '../src/world/osm';
import { setRoofStart } from '../src/slice/slice';

setRoofStart(true); // the browser has roof start on (CC-200, owner 2026-11-01): store what the live Slicer will confirm

const args = process.argv.slice(2), arg = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const dir = 'public/assets/places', outFile = arg('--out') ?? `${dir}/slicer-defaults.json`, budgetS = Number(arg('--budget-s') ?? 600);
const index = JSON.parse(readFileSync(`${dir}/index.json`, 'utf8')) as { slug: string }[];
const only = arg('--slug')?.split(',');
const prev: DefaultsFile | null = existsSync(outFile) ? JSON.parse(readFileSync(outFile, 'utf8')) : null;
const r1 = (v: number) => Math.round(v * 10) / 10;
const snap = (v: number) => Math.round(v * 2) / 2; // the cut slider moves in halves

function one(slug: string): SlicerDefault {
  const t0 = Date.now(), over = () => (Date.now() - t0) / 1000 > budgetS;
  const pl = JSON.parse(readFileSync(`${dir}/${slug}.json`, 'utf8')) as ReadyPlace;
  const p: PlaceInput = { answer: pl.answer, lat: pl.lat, lon: pl.lon, ground: pl.ground ? { radius: pl.radius, ...pl.ground } : null };
  const mk = (shrink: number, cutM: number, line: Line, note?: string): SlicerDefault => {
    const rp = replayDefault({ shrink, cutM, line }, p, true);
    return { slug, clear: rp.cleared, shrink, cutM, line, lengthM: r1(rp.lengthM), clearS: rp.clearS, checkVersion: CHECK_VERSION, ...(note ? { note } : {}) };
  };
  const tried: SlicerDefault[] = [];
  // (1) the lane stored with the place
  const L = pl.lane;
  if (L?.cleared) {
    const d = mk(L.shrink, snap(L.levelM / L.shrink), L.line.map(r1) as Line);
    console.error(`${slug}: stored lane ${d.clear ? 'clears' : 'fails'} at ${d.cutM} m`);
    if (d.clear) return d;
    tried.push(d);
  }
  // (2) search: shrinks, then cut heights from the stored one outwards, the Slicer's own lane search at each
  const bs = buildingsFrom(pl.answer, pl.lat, pl.lon);
  const shrinks = [...new Set([...(L ? [L.shrink] : []), ...shrinkLadder(bs), 0.2])];
  for (const k of shrinks) {
    const st = stateAt(p, k), place = { mesh: st.mesh, pieces: st.pieces };
    const cuts: number[] = [];
    for (let c = 0.5; c <= st.range; c += 0.5) cuts.push(c);
    const centre = L ? L.levelM / k : st.range * 0.35;
    cuts.sort((a, b) => Math.abs(a - centre) - Math.abs(b - centre));
    for (const c of cuts) {
      if (over()) break;
      if (!quickLane(place, c * k)) continue;
      const lane = provedLane(place, c * k);
      if (!lane) continue;
      const line = laneLine(lane, k).flat().map(r1) as Line;
      const d = mk(k, c, line);
      console.error(`${slug}: k ${k} cut ${c} -> ${d.clear ? 'CLEARS' : 'replay differs'}`);
      if (d.clear) return d;
      tried.push(d);
    }
    if (over()) break;
  }
  const best = tried.sort((a, b) => b.lengthM - a.lengthM)[0];
  return best ? { ...best, clear: false, clearS: null, note: 'No line the simulator clears was found at any shrink or height tried. This is the closest attempt: the longest lane that was cut.' } : { slug, clear: false, shrink: shrinks[0], cutM: 0, line: [0, 0, 0, 0], lengthM: 0, clearS: null, checkVersion: CHECK_VERSION, note: 'No lane could be cut here at any shrink or height tried.' };
}

const slugs = index.map((x) => x.slug).filter((s) => !only || only.includes(s));
const done = new Map((prev?.places ?? []).map((d) => [d.slug, d]));
for (const s of slugs) { const t = Date.now(); const d = one(s); done.set(s, d); console.error(`== ${s}: ${d.clear ? 'clear' : 'NO CLEAR LINE'} (${Math.round((Date.now() - t) / 1000)} s)`); }
const out: DefaultsFile = { version: 1, checkVersion: CHECK_VERSION, places: index.map((x) => done.get(x.slug)).filter((x): x is SlicerDefault => !!x) };
writeFileSync(outFile, JSON.stringify(out, null, 2) + '\n');
console.error(`wrote ${outFile}: ${out.places.filter((d) => d.clear).length} clear of ${out.places.length}`);
