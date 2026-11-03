// Usage: node scripts/demo-fork-course.mjs [--out file] [--no-prove] [--record dir]
// Builds the fork demo course for photo 1 (a dance floor with benches and a pole with a string of bulbs, CC-133) and proves both lanes.
//   The benches, the pole and the bulb string are the REAL objects lifted from the photo (public/assets/demo/fork-objects/fork-*.glb, made by scripts/bake-fork-objects.mjs from the lifts of demo photo 1).
//   No hand-built shape is left: the physics comes from the platforms, the pole and the bars; the objects are the pictures drawn over them.
// It prints both lanes' ideal runs (ticks, the keys' places, the room for error) and records them in data/eval/fork/run.json.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'tsx/esm/api';

register();
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { buildForkCourse, proveFork, DEFAULT_FORK } = await import(resolve(root, 'src/sim/fork.ts'));

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i < 0 ? null : args[i + 1]; };
const out = flag('--out') ?? resolve(root, 'public/assets/demo/fork-bench-bulb.course.json');
const recordDir = flag('--record') ?? resolve(root, 'data/eval/fork');
const real = JSON.parse(readFileSync(resolve(root, 'public/assets/demo/fork-objects/fork-real.json'), 'utf8')); // the stretch factors the bake used and where each baked object stands
const URL = { bench: '/assets/demo/fork-objects/fork-bench.glb', pole: '/assets/demo/fork-objects/fork-pole.glb', bulbs: '/assets/demo/fork-objects/fork-bulbs.glb' };
const spec = DEFAULT_FORK;
const course = buildForkCourse(spec);
const item = (id, x, y) => ({ id, url: URL[id.split('-')[0]], x, y, z: 0, rotY: 0, scale: 1 });
course.scene = [
  ...spec.benches.map((b, i) => item(`bench-${i + 1}`, (b.x0 + b.x1) / 2, real.bench.itemY)), // each bench stands in the water's pit on its own legs: there is no floor between the benches
  item('pole-1', spec.poleX, real.pole.itemY),
  item('bulbs-1', real.bulbs.itemX, real.bulbs.itemY),
];

let report = [];
if (!args.includes('--no-prove')) {
  const proved = proveFork(course);
  report = proved.map((p) => ({ lane: p.id, cleared: p.cleared, ticks: p.ticks, seconds: Math.round(p.ticks / 1.2) / 100, effortJumps: p.effort, narrowestMs: p.narrowestMs, readAs: p.readAs, keys: { climbXs: p.plan.climbXs, jumpXs: p.plan.jumpXs, vaultXs: p.plan.vaultXs, hangTicks: p.plan.hangTicks } }));
  for (const r of report) console.log(`${r.lane}: ${r.cleared ? 'cleared' : 'NOT CLEARED'} in ${r.seconds} s, narrowest room ${r.narrowestMs} ms, effort ${r.effortJumps} jumps, read as ${r.readAs}`);
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(course, null, 2) + '\n');
mkdirSync(recordDir, { recursive: true });
writeFileSync(resolve(recordDir, 'run.json'), JSON.stringify({ experiment: 'fork', photo: 'demo photo 1', objects: URL, bake: real, course: out.replace(root + '/', ''), lanes: report }, null, 2) + '\n');
console.log('wrote', out);
