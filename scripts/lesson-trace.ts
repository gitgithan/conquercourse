// Lesson pictures (CC-133, docs/lessons-*.md): replays three recorded runs in the simulator and writes one frame per 4 ticks (a stepped clock: 30 frames
// per game second, never wall time) to a JSON file that scripts/lesson-film.py draws; also sweeps the release window of the pull-up bar to monkey bars hand-off.
// Run: npx tsx scripts/lesson-trace.ts <out dir>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { CourseData } from '../src/course/course';
import { routeCourse } from '../src/sim/branches';
import { DEFAULT_BARS, canReach, swingEnergy } from '../src/sim/bars';
import { recordPlan, inputOfMask, type InputLog } from '../src/sim/replay';
import { NO_INPUT, type RunnerInput } from '../src/sim/runner';
import { newWorld, stepWorld } from '../src/sim/world';

const out = process.argv[2] ?? 'lesson-trace';
mkdirSync(out, { recursive: true });
const load = (f: string) => JSON.parse(readFileSync(`public/assets/demo/${f}`, 'utf8'));

const STEP = 4; // ticks per frame: 120 Hz / 4 = 30 frames per game second
function trace(name: string, course: CourseData, log: InputLog) {
  let w = newWorld(course);
  const frames: unknown[] = [];
  let tick = 0;
  for (const [m, n] of log) for (let k = 0; k < n; k++) {
    w = stepWorld(w, inputOfMask(m), course);
    if (tick++ % STEP === 0) frames.push({ t: +(tick / 120).toFixed(3), x: +w.runner.x.toFixed(3), y: +w.runner.y.toFixed(3), mode: w.mode, l: w.bars?.l ?? null, r: w.bars?.r ?? null });
  }
  const t = course.terrain;
  writeFileSync(`${out}/${name}.json`, JSON.stringify({ name, ticks: tick, outcome: w.outcome, platforms: t.platforms, holds: course.holds ?? [], bars: course.bars ?? [], poles: (course as { climbPoles?: unknown[] }).climbPoles ?? [], frames }));
  console.log(name, 'ticks', tick, w.outcome, 'frames', frames.length);
}

const sw = load('swing-to-bars.course.json') as CourseData;
const swRun = load('swing-to-bars.run.json') as { log: InputLog; ticks: number; jumpX: number; swingTicks: number; releaseAfter: number };
trace('swing-to-bars', sw, swRun.log);

const fork = load('fork-bench-bulb.course.json') as CourseData;
for (const r of fork.branches![0].routes) {
  const c = routeCourse(fork, fork.branches![0].id, r.id);
  trace(`fork-${r.id}`, c, recordPlan(c, r.plan!).recorder.snapshot());
}

// The release window: same policy as scripts/make-swing-to-bars-demo.ts, with the tick the hands let go of the bar swept one tick at a time.
const row = sw.bars![0];
const E_TARGET = (DEFAULT_BARS.hang.gravity / ((2 / 3) * DEFAULT_BARS.hang.handHeight)) * (1 - Math.cos(1.0));
function play(swingTicks: number): boolean {
  let w = newWorld(sw);
  let jumped = false, hangTicks = 0, barsTicks = 0, tick = 0, lastReach = -10, onBars = false;
  while (w.outcome === 'running' && tick < 120 * 25) {
    let input: RunnerInput = { ...NO_INPUT, run: true };
    if (w.mode === 'run') {
      const air = !w.runner.grounded && w.runner.y > 0.3;
      if (!jumped && w.runner.x >= swRun.jumpX) jumped = true;
      const jumping = jumped && !onBars && hangTicks === 0;
      const regrab = hangTicks > 0 && !onBars;
      const e = jumping ? air : regrab ? hangTicks > swingTicks + 2 : false;
      input = { ...NO_INPUT, run: true, squat: onBars, jump: jumping && w.runner.grounded, handL: e, handR: e };
      if (regrab) hangTicks++;
    } else if (w.mode === 'hang' && w.hang) {
      hangTicks++;
      const rel = hangTicks > swingTicks;
      input = { ...NO_INPUT, handL: !rel, handR: !rel, run: !rel && w.hang.omega >= 0, left: !rel && w.hang.omega < 0 };
    } else if (w.mode === 'bars' && w.bars) {
      const b = w.bars; onBars = true; barsTicks++;
      const done = b.l >= row.n - 1 && b.r >= row.n - 1;
      const rel = done && barsTicks > swRun.releaseAfter;
      const hand = b.last === 1 ? 2 : 1;
      const want = !done && canReach(row, b, hand).ok && tick - lastReach > 4;
      if (want) lastReach = tick;
      const kip = swingEnergy(b) < E_TARGET || done ? (b.omega >= 0 ? 1 : -1) : 0;
      input = { ...NO_INPUT, handL: !rel, handR: !rel, run: kip > 0, left: kip < 0, reachL: want && hand === 1, reachR: want && hand === 2 };
    }
    w = stepWorld(w, input, sw); tick++;
  }
  return w.outcome === 'cleared';
}
const ok: number[] = [];
for (let s = 1; s <= 200; s++) if (play(s)) ok.push(s);
const runs: number[][] = [];
for (const s of ok) { const last = runs[runs.length - 1]; if (last && last[last.length - 1] === s - 1) last.push(s); else runs.push([s]); }
const window = { recordedSwingTicks: swRun.swingTicks, clearingTicks: ok, runs: runs.map((r) => ({ from: r[0], to: r[r.length - 1], ticks: r.length, ms: Math.round((r.length * 1000) / 120) })) };
writeFileSync(`${out}/release-window.json`, JSON.stringify(window, null, 2));
console.log(JSON.stringify(window.runs), 'recorded', swRun.swingTicks);
