// Bars pose film, step 1 (CC-133): replays a recorded monkey-bars run and writes the actor's bars pose (the same BarsPlayer the Course uses) every 4 ticks
// (a stepped clock: 30 frames per game second) to JSON, for scripts/bars-pose-film.py. Run: npx tsx scripts/bars-pose-trace.ts <run name> <out.json>
import { readFileSync, writeFileSync } from 'node:fs';
import type { CourseData } from '../src/course/course';
import { BarsPlayer } from '../src/motion/bars-actor';
import { actorStateFor } from '../src/motion/actor-state';
import { rigFromFrame } from '../src/motion/bars-pose';
import { parseClip } from '../src/motion/clip';
import { pivotOf } from '../src/sim/bars';
import { DEFAULT_HANG, handOffset } from '../src/sim/holds';
import { inputOfMask, type InputLog } from '../src/sim/replay';
import { newWorld, stepWorld } from '../src/sim/world';

const [name = 'bars', out = 'bars-pose-trace.json'] = process.argv.slice(2);
const course = JSON.parse(readFileSync(`public/assets/demo/${name}.course.json`, 'utf8')) as CourseData;
const run = JSON.parse(readFileSync(`public/assets/demo/${name}.run.json`, 'utf8')) as { log: InputLog };
const clip = parseClip(JSON.parse(readFileSync('public/assets/motion/run.json', 'utf8')));
const rig = rigFromFrame(clip.names, clip.parents, clip.frames[13]);
const player = new BarsPlayer(rig);
const frames: unknown[] = [];
let w = newWorld(course), tick = 0;
for (const [m, n] of run.log) for (let k = 0; k < n; k++) {
  w = stepWorld(w, inputOfMask(m), course);
  tick++;
  if (w.mode !== 'bars' || !w.bars) continue;
  const row = course.bars![w.bars.run];
  const pv = pivotOf(row, w.bars), off = handOffset({ hold: 0, theta: 0, omega: 0, ox: w.bars.ox, oy: w.bars.oy, et: w.bars.et });
  const at = { x: pv.x + off.x, y: pv.y + off.y - DEFAULT_HANG.handHeight };
  const s = actorStateFor(w, false, 1, row);
  const p = player.pose({ ...s.bars!, theta: s.swingTheta ?? 0, omega: s.swingOmega ?? 0 }, at, w.runner.tick, 1, 0.05);
  if (tick % 4 !== 0) continue;
  // clip axes (x left, y up, z forward) relative to the feet origin: draw side view = (z, y)
  frames.push({ t: +(tick / 120).toFixed(3), at, rungs: { l: s.bars!.left, r: s.bars!.right, y: s.bars!.y }, short: +p.reachShort.toFixed(3),
    joints: p.joints.map((j) => j.map((v) => +v.toFixed(3))) });
}
writeFileSync(out, JSON.stringify({ name, names: rig.names, parents: rig.parents, bars: course.bars, frames }));
console.log(name, 'frames', frames.length);
