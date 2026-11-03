// Builds public/assets/demo/swing-to-bars.course.json and swing-to-bars.run.json (CC-133, docs/bars.md): jump to a pull-up bar, swing, let go near the
// first rung of a row of monkey bars, press E again, reach along the row, let go and land. The ideal-run search does not know monkey bars,
// so the recorded key list is the proof; tests/swing-to-bars.test.ts plays it again.
import { writeFileSync } from 'node:fs';
import type { CourseData } from '../src/course/course';
import { DEFAULT_BARS, canReach, swingEnergy } from '../src/sim/bars';
import { InputRecorder } from '../src/sim/replay';
import { NO_INPUT, type RunnerInput } from '../src/sim/runner';
import { newWorld, stepWorld } from '../src/sim/world';

const row = { x: 8.9, y: 3.0, n: 6, gap: 0.6 };
const course: CourseData = {
  version: 1, name: 'Pull-up bar to monkey bars: swing, let go, catch the first rung', startX: 0, finishX: 40, jumpSpeed: 4.5,
  terrain: { waterY: -6, platforms: [{ x0: -10, x1: 5, top: 0 }, { x0: 14.5, x1: 44, top: 0 }] },
  grabReach: 0.4,
  holds: [{ x: 6.5, y: 3.0 }],
  bars: [row],
} as CourseData;

const E_TARGET = (DEFAULT_BARS.hang.gravity / ((2 / 3) * DEFAULT_BARS.hang.handHeight)) * (1 - Math.cos(1.0));

function play(jumpX: number, swingTicks: number, releaseAfter: number): { rec: InputRecorder; cleared: boolean; ticks: number } {
  const rec = new InputRecorder();
  let w = newWorld(course);
  let jumped = false, hangTicks = 0, barsTicks = 0, tick = 0, lastReachTick = -10, onBars = false;
  while (w.outcome === 'running' && tick < 120 * 25) {
    let input: RunnerInput = { ...NO_INPUT, run: true };
    if (w.mode === 'run') {
      const air = !w.runner.grounded && w.runner.y > 0.3;
      if (!jumped && w.runner.x >= jumpX) jumped = true;
      const jumping = jumped && !onBars && hangTicks === 0;
      const regrab = hangTicks > 0 && !onBars; // let go on the bar; E held again after two ticks in the air
      const e = jumping ? air : regrab ? hangTicks > swingTicks + 2 : false;
      input = { ...NO_INPUT, run: true, squat: onBars, jump: jumping && w.runner.grounded, handL: e, handR: e };
      if (regrab) hangTicks++;
    } else if (w.mode === 'hang' && w.hang) {
      hangTicks++;
      const release = hangTicks > swingTicks;
      input = { ...NO_INPUT, handL: !release, handR: !release, run: !release && w.hang.omega >= 0, left: !release && w.hang.omega < 0 };
    } else if (w.mode === 'bars' && w.bars) {
      const b = w.bars;
      onBars = true; barsTicks++;
      const done = b.l >= row.n - 1 && b.r >= row.n - 1;
      const release = done && barsTicks > releaseAfter;
      const hand = b.last === 1 ? 2 : 1;
      const want = !done && canReach(row, b, hand).ok && tick - lastReachTick > 4;
      if (want) lastReachTick = tick;
      const kip = swingEnergy(b) < E_TARGET || done ? (b.omega >= 0 ? 1 : -1) : 0;
      input = { ...NO_INPUT, handL: !release, handR: !release, run: kip > 0, left: kip < 0, reachL: want && hand === 1, reachR: want && hand === 2 };
    }
    rec.push(input);
    w = stepWorld(w, input, course);
    tick++;
  }
  if (onBars) stats.bars++;
  if (hangTicks) stats.hang++;
  return { rec, cleared: w.outcome === 'cleared', ticks: w.runner.tick };
}

const stats = { bars: 0, hang: 0 };
let best: { jumpX: number; swing: number; rel: number; ticks: number; rec: InputRecorder } | null = null;
const RELS = [0, 60, 120, 180, 240, 360, 480, 600];
for (let jx = 2.5; jx <= 4.6; jx += 0.3) for (let sw = 20; sw <= 300; sw += 4) for (const rel of RELS) {
  const r = play(jx, sw, rel);
  if (r.cleared && (!best || r.ticks < best.ticks)) best = { jumpX: jx, swing: sw, rel, ticks: r.ticks, rec: r.rec };
}
console.log('runs that hung', stats.hang, 'reached the bars', stats.bars);
if (!best) { console.error('no run clears'); process.exit(1); }
writeFileSync('public/assets/demo/swing-to-bars.course.json', JSON.stringify(course, null, 2) + '\n');
writeFileSync('public/assets/demo/swing-to-bars.run.json', JSON.stringify({ note: 'keys that clear swing-to-bars.course.json, one [bitmask, ticks] pair per run of equal keys (src/sim/replay.ts)', jumpX: best.jumpX, swingTicks: best.swing, releaseAfter: best.rel, ticks: best.ticks, log: best.rec.snapshot() }, null, 2) + '\n');
console.log('cleared', best.jumpX, best.swing, best.rel, best.ticks, best.rec.snapshot().length, 'runs');
