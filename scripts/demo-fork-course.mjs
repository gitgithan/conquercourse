// Usage: node scripts/demo-fork-course.mjs [id=path.glb ...] [--out file] [--no-prove] [--record dir]
// Builds the fork demo course for photo 1 (a dance floor with benches and a pole with a string of bulbs, CC-133) and proves both lanes.
//   ids: bench (one lifted bench, copied for the three benches), pole (the lamp pole), bulbs (the string of bulbs; the bar row hangs at it).
//   A bare path is matched by its name (bench / pole,lamp,post / bulb,string,light,bar). An id with no file stays a plain placeholder shape.
//   Lift outputs come from data/eval/demo-lifts/ and ../conquercourse-assets/eval-full/demo-lifts/; run it again when a real lift lands: the physics does not change, only the pictures.
// It prints both lanes' ideal runs (ticks, the keys' places, the room for error) and records them in data/eval/fork/run.json.
import { mkdirSync, writeFileSync } from 'node:fs';
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
const files = {};
const skip = new Set([out, recordDir]);
for (const a of args.filter((q, i) => !q.startsWith('--') && !skip.has(q) && !(i > 0 && args[i - 1].startsWith('--')))) {
  const m = /^(bench|pole|bulbs)=(.+)$/.exec(a);
  if (m) { files[m[1]] = m[2]; continue; }
  const n = a.toLowerCase();
  if (/bench/.test(n)) files.bench ??= a; else if (/pole|lamp|post/.test(n)) files.pole ??= a; else if (/bulb|string|light|bar/.test(n)) files.bulbs ??= a;
}

// a plain box standing on y = 0, centred: the placeholder for an object with no lift yet
const BOX_I = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7];
const CORNERS = [[-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1], [-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]];
// several boxes in one mesh: each part is [centre x, base y, centre z, width, height, depth]
const boxes = (parts) => {
  const p = [], i = [];
  parts.forEach(([cx, by, cz, w, h, d], n) => {
    for (const [sx, sy, sz] of CORNERS) p.push(cx + sx * w / 2, by + sy * h, cz + sz * d / 2);
    i.push(...BOX_I.map((k) => k + 8 * n));
  });
  return { positions: p.map((v) => Math.round(v * 1e4) / 1e4), indices: i };
};
const box = (w, h, d) => boxes([[0, 0, 0, w, h, d]]);
// a park bench that still reads as one from the side: a seat on two long legs that stand down in the pit, with a back (looks only; the walkable top is the platform at the seat height)
const benchShape = (w, top) => boxes([[0, top - 0.08, 0, w, 0.08, 0.6], [-w / 2 + 0.15, -3, 0, 0.1, top + 2.92, 0.5], [w / 2 - 0.15, -3, 0, 0.1, top + 2.92, 0.5], [0, top, -0.28, w, 0.4, 0.06]]);
const spec = DEFAULT_FORK;
const course = buildForkCourse(spec);
const item = (id, x, y, shape) => ({ id, ...(files[id.split('-')[0]] ? { url: files[id.split('-')[0]] } : { mesh: shape }), x, y, z: 0, rotY: 0, scale: 1 });
const lastBar = spec.barXs[spec.barXs.length - 1];
course.scene = [
  ...spec.benches.map((b, i) => item(`bench-${i + 1}`, (b.x0 + b.x1) / 2, 0, benchShape(b.x1 - b.x0, b.top))), // each bench stands in the water's pit on its own legs: there is no floor between the benches
  item('pole-1', spec.poleX, 0, box(0.22, spec.barY, 0.22)),
  item('bulbs-1', (spec.barXs[0] + lastBar) / 2, spec.barY, box(lastBar - spec.barXs[0], 0.06, 0.06)),
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
writeFileSync(resolve(recordDir, 'run.json'), JSON.stringify({ experiment: 'fork', photo: 'demo photo 1', files, course: out.replace(root + '/', ''), lanes: report }, null, 2) + '\n');
console.log('wrote', out);
