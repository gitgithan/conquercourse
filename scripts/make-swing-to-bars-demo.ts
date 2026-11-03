// Builds public/assets/demo/swing-to-bars.course.json and swing-to-bars.run.json (CC-133, docs/bars.md): jump to a pull-up bar, swing, let go near the
// first rung of a row of monkey bars, press E again, reach along the row, let go and land. The keys are the ideal-run search's own plan
// (src/sim/ideal.ts knows monkey bars since CC-133): the centre of every window, played once and recorded; tests/swing-to-bars.test.ts plays it again.
import { writeFileSync } from 'node:fs';
import type { CourseData } from '../src/course/course';
import { inputFor, searchIdealRun } from '../src/sim/ideal';
import { InputRecorder } from '../src/sim/replay';
import { newWorld, stepWorld } from '../src/sim/world';

const row = { x: 8.9, y: 3.0, n: 6, gap: 0.6 };
const course: CourseData = {
  version: 1, name: 'Pull-up bar to monkey bars: swing, let go, catch the first rung', startX: 0, finishX: 40, jumpSpeed: 4.5,
  terrain: { waterY: -6, platforms: [{ x0: -10, x1: 5, top: 0 }, { x0: 14.5, x1: 44, top: 0 }] },
  grabReach: 0.4,
  holds: [{ x: 6.5, y: 3.0 }],
  bars: [row],
} as CourseData;

const found = searchIdealRun(course);
if (!found.cleared) { console.error('the search finds no clear'); process.exit(1); }
const plan = found.plan;
const rec = new InputRecorder();
const st = { next: 0, caught: null as number | null, bedAt: null as number | null, hangAt: null as number | null, hangs: 0, vnext: 0, cnext: 0, inClimb: false, fnext: 0, airSince: null as number | null, bandTurned: false, barsAt: null as number | null, barsOk: 0, barsDoneAt: null as number | null, barsLast: -99, barsOff: false };
let w = newWorld(course);
while (w.outcome === 'running' && w.runner.tick < 120 * 25) { const input = inputFor(plan, w, st, course); rec.push(input); w = stepWorld(w, input, course); }
if (w.outcome !== 'cleared') { console.error('the recorded plan does not clear'); process.exit(1); }
writeFileSync('public/assets/demo/swing-to-bars.course.json', JSON.stringify(course, null, 2) + '\n');
writeFileSync('public/assets/demo/swing-to-bars.run.json', JSON.stringify({ note: 'keys that clear swing-to-bars.course.json, one [bitmask, ticks] pair per run of equal keys (src/sim/replay.ts); the ideal-run search plan, played once', jumpX: plan.jumpXs[0], swingTicks: plan.hangTicks![0], releaseAfter: plan.barsRelease, ticks: w.runner.tick, windows: found.windows, log: rec.snapshot() }, null, 2) + '\n');
console.log('cleared', plan.jumpXs[0], plan.hangTicks, plan.barsRelease, w.runner.tick, rec.snapshot().length, 'runs');
