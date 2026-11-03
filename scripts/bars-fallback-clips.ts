// Writes the procedural monkey-bars clips (src/motion/bars-pose.ts) in the repo's clip format, so they can go through the same
// plausibility gate as any captured or generated clip (CC-133).
//   npx tsx scripts/bars-fallback-clips.ts <out dir>
// Writes bars_travel.json, bars_idle.json and bars_kip.json (30 fps, y up, travel along +z, left on +x, supportedBy "overhead bars").
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { barsPose, rigFromFrame, travelAt, type TravelOpts, type V3 } from '../src/motion/bars-pose';

const run = JSON.parse(readFileSync('public/assets/motion/run.json', 'utf8'));
const rig = rigFromFrame(run.names, run.parents, run.frames[13]);
const FPS = 30, RUNG_Y = 2.2, X = 0.18;
const OPTS: TravelOpts = { rungGap: 0.4, rungY: RUNG_Y, handX: X, cycle: 1.2, move: 0.3 };
const SOURCE = 'procedural: two-bone arm solves to the rungs, body hung as a pendulum (src/motion/bars-pose.ts)';

const clip = (id: string, what: string, frames: V3[][]) => ({
  names: run.names, parents: run.parents, fps: FPS, frames: frames.map((f) => f.map((p) => p.map((v) => Math.round(v * 1e4) / 1e4))),
  id, move: id, what, source: SOURCE, supportedBy: ['overhead bars'], gravity: 9.81,
});

const travel = Array.from({ length: 5 * FPS }, (_, i) => { const s = travelAt(i / FPS, OPTS); return barsPose(rig, { grips: s.grips, reach: s.reach, swing: s.swing, bodyZ: s.bodyZ }).joints; });
const hangGrips = { left: [X, RUNG_Y, 0.2] as V3, right: [-X, RUNG_Y, 0.2] as V3 };
const idle = Array.from({ length: 3 * FPS }, (_, i) => barsPose(rig, { grips: hangGrips, swing: 0.02 * Math.sin((2 * Math.PI * i) / FPS / 2.4), kick: 0.03 * Math.sin((2 * Math.PI * i) / FPS / 2.4) }).joints);
// a kip: hands stay on the rung, each swing a little bigger; the legs drive it (they lead the body and the knees tuck at the front of the swing)
const kip = Array.from({ length: Math.round(4.5 * FPS) }, (_, i) => {
  const t = i / FPS, amp = 0.12 + 0.43 * Math.min(t / 3.6, 1), ph = (2 * Math.PI * t) / 1.5;
  const swing = amp * Math.sin(ph);
  return barsPose(rig, { grips: hangGrips, swing, kick: 0.9 * amp * Math.sin(ph + 0.9), tuck: Math.max(0, Math.sin(ph + 0.4)) * Math.min(amp / 0.4, 1) }).joints;
});

const out = process.argv[2] ?? 'test-results/bars';
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/bars_travel.json`, JSON.stringify(clip('bars_travel', 'hand over hand along overhead rungs', travel)));
writeFileSync(`${out}/bars_idle.json`, JSON.stringify(clip('bars_idle', 'hanging still from the rung', idle)));
writeFileSync(`${out}/bars_kip.json`, JSON.stringify(clip('bars_kip', 'a kip: swing the legs to build the swing again', kip)));
console.log('wrote 3 clips to', out);
