// Builds public/assets/demo/bars-lift.course.json and bars-lift.run.json (CC-133, docs/pipelines.md): a monkey-bars course made from the Saienji CC0 photo lift.
// The lift (public/assets/objects/monkey-bars-saienji-cc0.glb) is only the skin; the collider is the row the role-first clean-up measures from it
// (src/slice/role-collider.ts): height, span and ONE spacing. The keys are the ideal-run search's own plan, played once and recorded.
//   npx tsx scripts/make-bars-lift-demo.ts
import { readFileSync, writeFileSync } from 'node:fs';
import type { CourseData } from '../src/course/course';
import { inputFor, searchIdealRun } from '../src/sim/ideal';
import { InputRecorder } from '../src/sim/replay';
import { newWorld, stepWorld } from '../src/sim/world';
import { readGlbMesh } from '../src/slice/glb';
import { roleCollider } from '../src/slice/role-collider';

const GLB = 'public/assets/objects/monkey-bars-saienji-cc0.glb', TALL = 2.2; // the maker's typed height of the whole frame, as in data/eval/bar-photos
const b = readFileSync(GLB);
const lift = roleCollider(readGlbMesh(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer), 'bar', { knownHeight: TALL });
const m = lift.bars!;
const FIRST_RUNG_X = 12; // where the first measured rung stands along the run
const centreX = Math.round((FIRST_RUNG_X - m.first) * 100) / 100; // the skin's middle, so its rungs sit on the collider's rungs
const row = { x: FIRST_RUNG_X, y: m.height, n: m.rungs, gap: m.gap };
const lastX = row.x + (row.n - 1) * row.gap;
const course: CourseData = {
  version: 1, name: 'Monkey bars from a photo: the collider is measured, the photo is the skin', startX: 0, finishX: Math.round(lastX + 8), jumpSpeed: 4.5,
  terrain: { waterY: -6, platforms: [{ x0: -10, x1: 9, top: 0 }, { x0: Math.round(lastX + 4), x1: Math.round(lastX + 26), top: 0 }] },
  grabReach: 0.4,
  bars: [row],
  scene: [{ url: '/assets/objects/monkey-bars-saienji-cc0.glb', x: centreX, y: 0, z: 0, rotY: 0, scale: lift.scaleUsed, id: 'bars-skin' }],
};

const found = searchIdealRun(course);
console.log('collider', JSON.stringify(row), 'skin at', centreX, 'cleared', found.cleared);
if (!found.cleared) { console.error('the search finds no clear'); process.exit(1); }
const plan = found.plan, rec = new InputRecorder();
const st = { next: 0, caught: null as number | null, bedAt: null as number | null, hangAt: null as number | null, hangs: 0, vnext: 0, cnext: 0, inClimb: false, fnext: 0, airSince: null as number | null, bandTurned: false, barsAt: null as number | null, barsOk: 0, barsDoneAt: null as number | null, barsLast: -99, barsOff: false };
let w = newWorld(course);
while (w.outcome === 'running' && w.runner.tick < 120 * 25) { const input = inputFor(plan, w, st, course); rec.push(input); w = stepWorld(w, input, course); }
if (w.outcome !== 'cleared') { console.error('the recorded plan does not clear'); process.exit(1); }
writeFileSync('public/assets/demo/bars-lift.course.json', JSON.stringify(course, null, 2) + '\n');
writeFileSync('public/assets/demo/bars-lift.run.json', JSON.stringify({ note: 'keys that clear bars-lift.course.json (src/sim/replay.ts); the ideal-run search plan, played once', jumpX: plan.jumpXs[0], releaseAfter: plan.barsRelease, ticks: w.runner.tick, windows: found.windows, log: rec.snapshot() }, null, 2) + '\n');
console.log('cleared in', w.runner.tick, 'ticks');
