// CC-200 / CC-91: if the Slicer says a lane has a path, does the World Editor say the same?
// Usage: npx tsx scripts/lane-equal-sweep.ts --slug shibuya-tokyo [--out file.json] [--step 1] [--modes off,on]
// For one ready place at the stored shrink, at every cut height (step metres), with roof start off and on:
//   1. the Slicer's verdict: provedLane (the ideal-run proof the Slicer shows as "a path exists"), and the winning keys (ideal-run plan) for that lane;
//   2. the Editor's verdict: the hand-over as map.ts + editor.ts do it (pieces where they stood, the water sunk to 0 by the cut, the lane read by roleCourse), then the editor's own ideal-run search;
//   3. the Slicer's keys replayed in the editor-built course.
// Heavy: run it on a VM, one process per place.
import { readFileSync, writeFileSync } from 'node:fs';
import type { ReadyPlace } from '../src/world/places';
import { provedLane, worldOf } from '../src/slice/slicer-core';
import { stateAt, type PlaceInput } from '../src/slice/slicer-default';
import { laneToCourse, setRoofStart } from '../src/slice/slice';
import { laneProfile } from '../src/slice/world';
import { roleCourse } from '../src/slice/roles';
import { handoverLane } from '../src/slice/slicer';
import { playPlan, searchIdealRun } from '../src/sim/ideal';

const args = process.argv.slice(2), arg = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const slug = arg('--slug'); if (!slug) throw new Error('--slug needed');
const step = Number(arg('--step') ?? 1), modes = (arg('--modes') ?? 'off,on').split(',');
const pl = JSON.parse(readFileSync(`public/assets/places/${slug}.json`, 'utf8')) as ReadyPlace;
const p: PlaceInput = { answer: pl.answer, lat: pl.lat, lon: pl.lon, ground: pl.ground ? { radius: pl.radius, ...pl.ground } : null };
const k = pl.lane?.shrink ?? 0.4, st = stateAt(p, k), place = { mesh: st.mesh, pieces: st.pieces };
const sig = (c: { terrain: { platforms: unknown[] }; finishX: number }) => JSON.stringify([c.terrain.platforms, c.finishX]);

interface Row { cut: number; roofStart: boolean; slicer: boolean; editor: boolean | null; agree: boolean; sameCourse: boolean | null; replayClears: boolean | null; lane?: { angle: number; offset: number; length: number } }
const rows: Row[] = [];
for (const mode of modes) {
  const on = mode === 'on';
  for (let c = step; c <= st.range; c += step) {
    setRoofStart(on);
    let row: Row;
    try {
      const sum = provedLane(place, c * k); // the Slicer says "a path exists" (or not)
      if (!sum) row = { cut: c, roofStart: on, slicer: false, editor: null, agree: true, sameCourse: null, replayClears: null };
      else {
        const lane = handoverLane(sum, c, k); // what "Build the picked buildings" sends
        const slicerCourse = laneToCourse((() => { const pr = laneProfile(worldOf(st.pieces), lane); return { cells: [...pr.cells], length: pr.length }; })());
        const keys = searchIdealRun(slicerCourse); // the Slicer's winning keys
        // the editor: pieces sink by the cut, the water starts at 0 (editor.ts, laneFrom slicer)
        const sunk = worldOf(st.pieces).map((q) => ({ ...q, y: q.y - lane.level }));
        const ed = roleCourse(sunk, { angle: lane.angle, offset: lane.offset, level: 0 }, 'My world');
        const edRes = ed.length >= 8 ? searchIdealRun(ed.course) : { cleared: false };
        const replay = keys.cleared && keys.plan ? playPlan(ed.course, keys.plan).world.outcome === 'cleared' : null;
        row = { cut: c, roofStart: on, slicer: true, editor: edRes.cleared, agree: edRes.cleared, sameCourse: sig(slicerCourse) === sig(ed.course), replayClears: replay, lane: { angle: sum.angle, offset: sum.offset, length: sum.length } };
      }
    } catch (e) { console.error('error', slug, c, (e as Error).message); row = { cut: c, roofStart: on, slicer: false, editor: null, agree: true, sameCourse: null, replayClears: null }; }
    setRoofStart(false);
    rows.push(row); console.error(`${slug} roof ${mode} cut ${c}: slicer ${row.slicer} editor ${row.editor} same ${row.sameCourse} replay ${row.replayClears}`);
  }
}
const sum = { slug, shrink: k, range: st.range, step, cases: rows.length, slicerYes: rows.filter((r) => r.slicer).length, disagree: rows.filter((r) => !r.agree).length, courseDiffers: rows.filter((r) => r.sameCourse === false).length, replayFails: rows.filter((r) => r.replayClears === false).length, rows };
writeFileSync(arg('--out') ?? `/tmp/laneeq-${slug}.json`, JSON.stringify(sum, null, 2) + '\n');
console.error(`== ${slug}: slicer yes ${sum.slicerYes}/${sum.cases}, disagree ${sum.disagree}, course differs ${sum.courseDiffers}, replay fails ${sum.replayFails}`);
