// One Course take for film A on the stepped clock.
// Usage: node scripts/film-a-course.mjs --name run1 --query "course=/assets/demo/training.course.json&bot=ideal&welcome=0&film=dive" --frames 90
//        [--skip 22] [--ramp 1.0,5.6,0.25] [--out films-a] [--fps 30] [--base http://localhost:5173] [--keys "ArrowRight@0"] [--chrome 1]
// --skip S steps the game S seconds before the first picture (no pictures). --ramp from,to,rate: between those film seconds the game runs at `rate` times real time (smooth ease in and out).
// --chrome 1 keeps the HUD panels (the film camera hides them by itself); the plain game camera is used when the query has no `film=`.
import { Shot, arg } from './film-lib.mjs';

const name = arg('name', 'course'), out = arg('out', 'films-a'), fps = Number(arg('fps', 30)), frames = Number(arg('frames', 60));
const skip = Number(arg('skip', 0)), base = arg('base', 'http://localhost:5173');
const ramps = (arg('ramp', '') || '').split(';').filter(Boolean).map((r) => r.split(',').map(Number));
const smooth = (x) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c); };
const rateAt = (sec) => ramps.reduce((r, [a, b, k]) => r * (1 + (k - 1) * smooth((sec - a) / 0.25) * smooth((b - sec) / 0.25)), 1);
const shot = new Shot({ name, outDir: out, fps, width: Number(arg('width', 1280)), height: Number(arg('height', 720)) });
const page = await shot.open(`${base}/?${arg('query', '')}&welcome=0`, { cursor: false, noTransitions: false, waitReady: (p) => p.waitForSelector('html[data-ready=true]', { timeout: 180000 }) });
shot.sub = 2;
if (skip > 0) { await shot.advance(skip * 1000); }
await page.evaluate(() => window.__filmZero?.());
const log = [];
for (let i = 0; i < frames; i++) {
  shot.rate = rateAt(i / fps);
  await shot.frames(1);
  if (i % 3 === 0) log.push(await page.evaluate(() => ({ x: Number(document.documentElement.dataset.x), tick: Number(document.documentElement.dataset.tick), out: document.documentElement.dataset.outcome, g: document.documentElement.dataset.grounded, mode: document.documentElement.dataset.mode })));
}
await shot.close();
(await import('node:fs')).writeFileSync(`${out}/${name}/runner.json`, JSON.stringify(log) + '\n');
console.log(name, 'runner x from', log[0]?.x, 'to', log[log.length - 1]?.x, 'outcome', log[log.length - 1]?.out);
process.exit(0);
