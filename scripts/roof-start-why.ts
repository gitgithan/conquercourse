// CC-200: why does roof start lose a cut height the old rule solved? For one place and cut heights, take the lane the old rule proves and read the SAME lane with roof start on.
// Usage: npx tsx scripts/roof-start-why.ts --slug eixample-barcelona --cuts 3,6,9 [--out file.json]
import { readFileSync, writeFileSync } from 'node:fs';
import type { ReadyPlace } from '../src/world/places';
import { provedLane, worldOf } from '../src/slice/slicer-core';
import { stateAt, type PlaceInput } from '../src/slice/slicer-default';
import { bestSlices, surfaceSamples, describe, laneToCourse, setRoofStart } from '../src/slice/slice';
import { laneProfile } from '../src/slice/world';
import { searchIdealRun } from '../src/sim/ideal';

const args = process.argv.slice(2), arg = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const slug = arg('--slug')!, cuts = (arg('--cuts') ?? '').split(',').map(Number).filter((v) => v > 0);
const pl = JSON.parse(readFileSync(`public/assets/places/${slug}.json`, 'utf8')) as ReadyPlace;
const p: PlaceInput = { answer: pl.answer, lat: pl.lat, lon: pl.lon, ground: pl.ground ? { radius: pl.radius, ...pl.ground } : null };
const k = pl.lane?.shrink ?? 0.4, st = stateAt(p, k), place = { mesh: st.mesh, pieces: st.pieces };
const r1 = (v: number) => Math.round(v * 10) / 10;
const out: unknown[] = [];
for (const c of cuts) {
  setRoofStart(false);
  const lane0 = provedLane(place, c * k);
  if (!lane0) { out.push({ cut: c, note: 'old rule has no proved lane' }); continue; }
  const o = { angle: lane0.angle, offset: lane0.offset, level: c * k };
  const read = (on: boolean) => {
    setRoofStart(on);
    const pr = laneProfile(worldOf(st.pieces), o), d = describe(pr);
    const course = laneToCourse({ cells: [...pr.cells], length: pr.length });
    const cleared = pr.length >= 8 ? searchIdealRun(course).cleared : false;
    const filled = pr.cells.filter((v) => v !== null) as number[];
    const first = pr.cells.findIndex((v) => v !== null);
    const lowFloor = filled.filter((v) => v < 0.5).length; // cells at or near the cut: street floor, not a roof
    setRoofStart(false);
    return { cleared, length: r1(pr.length), gaps: d.gaps, maxRise: r1(d.maxRise), maxDrop: r1(d.maxDrop), filled: filled.length, cells: pr.cells.length, firstFilledAt: first, lowFloorCells: lowFloor, minH: r1(Math.min(...filled)), maxH: r1(Math.max(...filled)) };
  };
  const row = { cut: c, lane: { turnDeg: r1((lane0.angle * 180) / Math.PI), offset: r1(lane0.offset) }, off: read(false), on: read(true), onOtherLane: (() => { setRoofStart(true); const l = provedLane(place, c * k); setRoofStart(false); return !!l; })(), onWiderSearch: (() => { setRoofStart(true); const w = worldOf(st.pieces); const f = bestSlices({ positions: surfaceSamples(place.mesh, 80) }, { levels: [c * k], top: 1, centre: { x: 0, z: 0 }, maxProofs: 40, reprofile: (cd) => laneProfile(w, cd) }); setRoofStart(false); return f.length > 0; })() };
  out.push(row); console.error(JSON.stringify(row));
}
writeFileSync(arg('--out') ?? `/tmp/why-${slug}.json`, JSON.stringify(out, null, 2) + '\n');
