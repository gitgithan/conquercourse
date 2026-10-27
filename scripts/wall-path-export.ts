// Exports the simulator's wall run at an entry speed: feet path up the curve, then the mantle (CC-17).
// Usage: npx tsx scripts/wall-path-export.ts 7 data/eval/cc-17-wall/inputs/sim_path.json
import { writeFileSync } from 'node:fs';
import { DEFAULT_WALL, runWall } from '../src/sim/wall';
import { wallPath, MANTLE_RUN } from '../src/sim/world';
import { TICKS_PER_SECOND } from '../src/sim/units';

const speed = Number(process.argv[2] ?? 7);
const out = process.argv[3] ?? 'data/eval/cc-17-wall/inputs/sim_path.json';
const p = DEFAULT_WALL;
const result = runWall(speed, p);
const path = wallPath(result, 0, p.height);
// The sim's grab tick needs hands 2.45 m from the hips, which no body reaches (see the README, round 0).
// The body-feasible variant keeps the sim's own climb and mantle (wallPath) but grabs at the apex of the climb.
const full = runWall(speed, { ...p, stopAtGrab: false });
const apexTick = full.path.reduce((best, q, i) => (q.y > full.path[best].y ? i : best), 0);
const apexPath = wallPath({ ...full, grabTick: apexTick }, 0, p.height);
const doc = {
  note: 'Feet positions per simulator tick (120 Hz); x runs toward the wall from the foot of the curve, y is up. The curve is a quarter circle of radius = height.',
  entrySpeed: speed,
  tickRate: TICKS_PER_SECOND,
  params: p,
  mantleRun: MANTLE_RUN,
  grabbed: result.grabbed,
  grabTick: result.grabTick,
  needed: result.needed,
  topEdge: { x: p.radius ?? p.height, y: p.height },
  path: path.map((q) => [Math.round(q.x * 1e5) / 1e5, Math.round(q.y * 1e5) / 1e5]),
  apexTick,
  apexPath: apexPath.map((q) => [Math.round(q.x * 1e5) / 1e5, Math.round(q.y * 1e5) / 1e5]),
};
writeFileSync(out, JSON.stringify(doc, null, 2) + '\n');
console.log(JSON.stringify({ grabbed: doc.grabbed, grabTick: doc.grabTick, ticks: path.length, grabFeet: path[result.grabTick!], end: path[path.length - 1], apexTick, apexTicks: apexPath.length }));
