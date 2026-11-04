// Promo v2 segment: the Courses card, scrolled from the Dojo group down through the Labs group.
// usage: node courses.mjs <playwright> <outdir> [params.json] [baseUrl]
import { readFileSync } from 'node:fs';
import { openSession } from './lib.mjs';
const [pw, out, pfile, base = 'http://localhost:5173'] = process.argv.slice(2);
const P = JSON.parse(readFileSync(pfile || new URL('./params/courses.json', import.meta.url), 'utf8'));
const S = await openSession({ url: null, out, pw }); const p = S.p;
await p.goto(base + P.url);
await p.waitForSelector('#courses-btn', { state: 'attached', timeout: 90000 }); await S.settle(3500); await S.hideChrome();
await p.evaluate(() => document.querySelector('#courses-btn').click());
await p.waitForSelector('.wg-card', { timeout: 30000 }); await S.settle(2500);
const info = await p.evaluate(([a, b]) => {
  const grp = (s) => [...document.querySelectorAll('.wg *')].find((e) => e.children.length === 0 && e.textContent.startsWith(s));
  const d = grp(a), l = grp(b), f = grp('Labs, Pipelines');
  let sc = d; while (sc && !(sc.scrollHeight > sc.clientHeight + 5 && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
  sc.dataset.sc = '1'; const r0 = sc.getBoundingClientRect();
  return { dojo: d.getBoundingClientRect().top - r0.top + sc.scrollTop, labs: l.getBoundingClientRect().top - r0.top + sc.scrollTop, pipes: f.getBoundingClientRect().top - r0.top + sc.scrollTop, max: sc.scrollHeight - sc.clientHeight };
}, [P.fromGroup, P.toGroup]);
console.log(JSON.stringify(info));
const a = Math.max(0, info.dojo - 70), z = Math.min(info.max, info.pipes - 120);
await p.evaluate((a) => { document.querySelector('[data-sc]').scrollTop = a; }, a); await S.settle(900);
await S.rec(P.holdStart); S.marks.dojoGroup = S.n / S.fps;
await S.scrollTo('[data-sc]', z, P.scrollSecs); S.marks.labsGroup = S.n / S.fps;
await S.rec(P.holdEnd);
await S.finish({ params: P, scroll: { from: a, to: z } });
