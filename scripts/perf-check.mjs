// Performance check (CC-75): loads reference scenes with ?perf=1 in software GPU (SwiftShader), reads the overlay's numbers
// (draw calls, triangles, meshes, instances, geometries, load time, heap) and, with --budget, fails when a scene goes over its budget.
//   node scripts/perf-check.mjs                      print a table
//   node scripts/perf-check.mjs --write out.json     also save the numbers
//   node scripts/perf-check.mjs --budget             fail if a scene's draw calls or triangles exceed scripts/perf-budget.json
// Timings in software GPU are relative: compare before and after on the same machine, not against a real graphics card.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const port = process.env.PORT ?? '5473';
const args = process.argv.slice(2);
const writeTo = args.includes('--write') ? args[args.indexOf('--write') + 1] : null;
const useBudget = args.includes('--budget');
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;

// two synthetic courses that stand for a crowded editor course and a city with thousands of buildings
const base = JSON.parse(readFileSync('public/assets/demo/stack.course.json', 'utf8'));
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const box = (w, h, d) => ({
  positions: [-w / 2, 0, -d / 2, w / 2, 0, -d / 2, w / 2, 0, d / 2, -w / 2, 0, d / 2, -w / 2, h, -d / 2, w / 2, h, -d / 2, w / 2, h, d / 2, -w / 2, h, d / 2],
  indices: [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5],
});
const manyPieces = structuredClone(base);
manyPieces.name = 'perf many pieces';
manyPieces.scene = [];
for (let i = 0; i < 300; i++) manyPieces.scene.push({ x: 2 + rnd() * 40, y: 0, z: -6 + rnd() * 12, rotY: rnd() * 6, scale: 1, mesh: box(0.6 + rnd(), 0.3 + rnd(), 0.6 + rnd()) });
for (let i = 0; i < 30; i++) manyPieces.scene.push({ x: 2 + rnd() * 40, y: 0, z: -6 + rnd() * 12, rotY: rnd() * 6, scale: 1, url: '/assets/objects/bench-concrete.glb' });
for (let i = 0; i < 12; i++) manyPieces.scene.push({ x: 2 + rnd() * 40, y: 0, z: 8 + rnd() * 4, rotY: 0, scale: 3, stack: ['3-3-3', '3-6-3', '6-6'][i % 3] });
const bigPlace = structuredClone(base);
bigPlace.name = 'perf big place';
{ // 3000 buildings in a 300 m square, one mesh like a map place
  const positions = [], indices = [];
  for (let i = 0; i < 3000; i++) {
    const b = box(6 + rnd() * 10, 4 + rnd() * 14, 6 + rnd() * 10), ox = -60 + rnd() * 300, oz = -150 + rnd() * 300, at = positions.length / 3;
    for (let k = 0; k < b.positions.length; k += 3) positions.push(b.positions[k] + ox, b.positions[k + 1], b.positions[k + 2] + oz);
    for (const j of b.indices) indices.push(at + j);
  }
  bigPlace.scene = [{ x: 0, y: -1, z: 0, rotY: 0, scale: 1, mesh: { positions, indices } }];
}
const synthetic = { '/assets/perf/many-pieces.course.json': manyPieces, '/assets/perf/big-place.course.json': bigPlace };

const SCENES = [
  { id: 'montmartre', url: '/?course=/assets/experiments/osm/montmartre-paris.course.json' },
  { id: 'san-francisco', url: '/?course=/assets/experiments/osm/san-francisco-lombard.course.json' },
  { id: 'coaster', url: '/?course=/assets/demo/coaster.course.json' },
  { id: 'stacks', url: '/?course=/assets/demo/stack.course.json' },
  { id: 'many-pieces', url: '/?course=/assets/perf/many-pieces.course.json' },
  { id: 'big-place', url: '/?course=/assets/perf/big-place.course.json' },
].filter((s) => !only || only.includes(s.id));

const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist', '--enable-precise-memory-info'];
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const results = {};
try {
  await new Promise((r) => setTimeout(r, 3500));
  const browser = await chromium.launch({ args: flags });
  for (const sc of SCENES) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = []; page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)));
    for (const [path, json] of Object.entries(synthetic)) await page.route(`**${path}`, (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(json) }));
    const t0 = Date.now();
    await page.goto(`http://localhost:${port}${sc.url}${sc.url.includes('?') ? '&' : '?'}perf=1`);
    await page.waitForFunction(() => { const d = document.documentElement.dataset.perf; return d && JSON.parse(d).calls > 0; }, null, { timeout: 120000 });
    const loadMs = Date.now() - t0;
    await page.waitForTimeout(5000); // the pictures of objects load after the first frame
    const samples = [];
    for (let i = 0; i < 6; i++) { samples.push(JSON.parse(await page.evaluate(() => document.documentElement.dataset.perf))); await page.waitForTimeout(500); }
    const pick = (k) => median(samples.map((s) => s[k]));
    const best = (k) => Math.min(...samples.map((s) => s[k])); // timings in software GPU jump around when the machine is busy: the best sample is the fairest
    results[sc.id] = {
      backend: samples[0].backend, loadMs, calls: pick('calls'), triangles: pick('triangles'), meshes: pick('meshes'), instancedMeshes: pick('instancedMeshes'), instances: pick('instances'),
      geometries: pick('geometries'), textures: pick('textures'), frameMs: best('frameMs'), renderMs: best('renderMs'), simMs: pick('simMs'), heapMB: pick('heapMB'), errors,
    };
    await page.close();
  }
  await browser.close();
} finally { server.kill(); }

const cols = ['calls', 'triangles', 'meshes', 'instancedMeshes', 'geometries', 'loadMs', 'renderMs', 'heapMB'];
console.log(['scene'.padEnd(14), ...cols.map((c) => c.padStart(11))].join(' '));
for (const [id, r] of Object.entries(results)) console.log([id.padEnd(14), ...cols.map((c) => String(r[c]).padStart(11))].join(' '), r.errors.length ? `ERRORS ${r.errors.join('; ')}` : '');
if (writeTo) writeFileSync(writeTo, JSON.stringify(results, null, 2) + '\n');
if (useBudget) {
  const budget = JSON.parse(readFileSync('scripts/perf-budget.json', 'utf8'));
  let bad = 0;
  for (const [id, r] of Object.entries(results)) {
    const b = budget[id]; if (!b) continue;
    for (const k of ['calls', 'triangles']) if (r[k] > b[k]) { console.log(`OVER BUDGET ${id}.${k}: ${r[k]} > ${b[k]}`); bad++; }
    if (r.errors.length) { console.log(`PAGE ERRORS in ${id}`); bad++; }
  }
  if (bad) process.exit(1);
  console.log('within budget');
}
