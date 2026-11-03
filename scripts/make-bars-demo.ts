// Builds public/assets/demo/bars.course.json and bars.run.json (CC-133, docs/bars.md).
// The run is found by a small search over the jump place and the release tick, then recorded as keys; tests/bars-course.test.ts plays the keys again.
// The ideal-run search does not know monkey bars, so this recorded run is the proof that the course clears.
import { writeFileSync } from 'node:fs';
import type { CourseData } from '../src/course/course';
import { DEFAULT_BARS, canReach, swingEnergy } from '../src/sim/bars';
import { InputRecorder } from '../src/sim/replay';
import { NO_INPUT, type RunnerInput } from '../src/sim/runner';
import { newWorld, stepWorld } from '../src/sim/world';

const row = { x: 12, y: 3.0, n: 6, gap: 0.6 };
const course: CourseData = {
  version: 1, name: 'Monkey bars: jump, reach hand over hand, let go', startX: 0, finishX: 36, jumpSpeed: 4.5,
  terrain: { waterY: -6, platforms: [{ x0: -10, x1: 9, top: 0 }, { x0: 18, x1: 40, top: 0 }] },
  grabReach: 0.4,
  bars: [row],
} as CourseData;

const E_TARGET = (DEFAULT_BARS.hang.gravity / ((2 / 3) * DEFAULT_BARS.hang.handHeight)) * (1 - Math.cos(1.0));

function play(jumpX: number, releaseAfter: number): { rec: InputRecorder; cleared: boolean; ticks: number } {
  const rec = new InputRecorder();
  let w = newWorld(course);
  let flown = false, barsTicks = 0, tick = 0, lastReachTick = -10;
  while (w.outcome === 'running' && tick < 120 * 40) {
    let input: RunnerInput = { ...NO_INPUT, run: true };
    if (w.mode === 'run') {
      const jumping = !flown && w.runner.x >= jumpX;
      input = { ...NO_INPUT, run: true, squat: flown, jump: jumping && w.runner.grounded, jumpSpeed: 0, handL: jumping && !w.runner.grounded && w.runner.y > 0.3, handR: jumping && !w.runner.grounded && w.runner.y > 0.3 };
    } else if (w.mode === 'bars' && w.bars) {
      const b = w.bars;
      barsTicks++; flown = true;
      const done = b.l >= row.n - 1 && b.r >= row.n - 1;
      const release = done && barsTicks > releaseAfter;
      const hand = b.last === 1 ? 2 : 1;
      const want = !done && canReach(row, b, hand).ok && tick - lastReachTick > 4;
      if (want) lastReachTick = tick;
      const e = !release;
      const kip = swingEnergy(b) < E_TARGET || done ? (b.omega >= 0 ? 1 : -1) : 0;
      input = { ...NO_INPUT, handL: e, handR: e, run: kip > 0, left: kip < 0, reachL: want && hand === 1, reachR: want && hand === 2 };
    }
    rec.push(input);
    w = stepWorld(w, input, course);
    tick++;
  }
  return { rec, cleared: w.outcome === 'cleared', ticks: w.runner.tick };
}

let best: { jumpX: number; rel: number; ticks: number; rec: InputRecorder } | null = null;
for (let jx = 5; jx <= 8.6; jx += 0.4) for (let rel = 0; rel <= 900; rel += 1) {
  const r = play(jx, rel);
  if (r.cleared && (!best || r.ticks < best.ticks)) best = { jumpX: jx, rel, ticks: r.ticks, rec: r.rec };
}
if (!best) { console.error('no run clears'); process.exit(1); }
writeFileSync('public/assets/demo/bars.course.json', JSON.stringify(course, null, 2) + '\n');
writeFileSync('public/assets/demo/bars.run.json', JSON.stringify({ note: 'keys that clear bars.course.json, one [bitmask, ticks] pair per run of equal keys (src/sim/replay.ts)', jumpX: best.jumpX, releaseAfter: best.rel, ticks: best.ticks, log: best.rec.snapshot() }, null, 2) + '\n');
console.log('cleared', best.jumpX, best.rel, best.ticks, best.rec.snapshot().length, 'runs');
