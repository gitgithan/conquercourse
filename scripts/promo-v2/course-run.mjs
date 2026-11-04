// Promo v2 segment: the lifted bench-and-bulb course run by the ideal-line bot with the Debug view on: side camera, 45 degree camera, then the front (Looking ahead) inset.
// usage: node course-run.mjs <playwright> <outdir> [params.json] [baseUrl]
import { readFileSync } from 'node:fs';
import { openSession } from './lib.mjs';
const [pw, out, pfile, base = 'http://localhost:5173'] = process.argv.slice(2);
const P = JSON.parse(readFileSync(pfile || new URL('./params/course-run.json', import.meta.url), 'utf8'));
const S = await openSession({ url: null, out, pw, rafStep: true }); const p = S.p;
S.dt = (1000 / S.fps) * (P.rate ?? 1);                     // slow motion: the game clock moves `rate` of real time per picture; every picture is still taken, so it stays smooth
await p.goto(base + P.url);
await p.waitForSelector('html[data-ready=true]', { timeout: 180000 });
await S.settle(1500); await S.hideChrome();
await p.keyboard.press('KeyB');                           // Debug view on
if (P.hideControls) await p.keyboard.press('KeyH');       // the Controls card off
await S.settle(600);
await S.rec(P.sideSecs); S.marks.side = S.n / S.fps;      // side camera
await p.keyboard.press('KeyC'); await S.rec(P.angleSecs); S.marks.angle = S.n / S.fps;   // 45 degree camera
await p.keyboard.press('KeyC'); await p.keyboard.press('KeyC'); // back round to side; the front (Looking ahead) inset is on from the start (F would hide it)
await S.rec(P.frontSecs); S.marks.front = S.n / S.fps;
await S.finish({ params: P, runner: await p.evaluate(() => window.__filmRunner ?? null) });
