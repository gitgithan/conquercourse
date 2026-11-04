// Promo v2 segment: the Dojo gap lesson, each Try It slider eased up and back while the graph redraws.
// usage: node dojo.mjs <playwright> <outdir> [params.json] [baseUrl]
import { readFileSync } from 'node:fs';
import { openSession } from './lib.mjs';
const [pw, out, pfile, base = 'http://localhost:5173'] = process.argv.slice(2);
const P = JSON.parse(readFileSync(pfile || new URL('./params/dojo.json', import.meta.url), 'utf8'));
const S = await openSession({ url: null, out, pw }); const p = S.p;
await p.goto(base + P.url);
await p.waitForSelector('.dojo', { timeout: 60000 });
if (P.zoom) await p.addStyleTag({ content: `.dojo.v2{zoom:${P.zoom}}` });
await S.settle(2500); await S.hideChrome();
await p.click('.path .node:nth-child(2)'); await p.waitForSelector('input[type=range]'); await S.settle(1200);
await S.rec(P.holdStart); S.marks.lesson = S.n / S.fps;
const knobs = await p.$$eval('input[type=range]', (a) => a.map((x) => [x.id, +x.min, +x.max, +x.value]));
console.log(JSON.stringify(knobs));
for (const [id, mn, mx, v] of knobs) {
  const to = v + (mx - v) * 0.55, mid = mn + (mx - mn) * 0.2;
  await p.evaluate((i) => document.getElementById(i)?.scrollIntoView({ block: 'center' }), id).catch(() => {});
  for (const [, tgt] of [[v, to], [to, mid]]) { await S.slide('#' + id, tgt, P.moveSecs); await S.rec(0.3); }
  S.marks['knob-' + id] = S.n / S.fps;
}
await S.rec(P.holdEnd);
await S.finish({ params: P });
