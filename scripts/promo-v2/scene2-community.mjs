// Promo v2 scene 2 (CC-133): the real Community flow, clips 2a (upload the photo) and 2b (SAM 3 outlines the things).
// usage: node scene2-community.mjs <playwright> <outdir> <2a|2b> <lifts-dir> <suggest-dir> <bulbs-cutout.png> [baseUrl]
// The page is the real app (vite dev server). Only /api/segment is answered by us, with the prepared SAM 3 result of demo photo 1
// (<suggest-dir>/suggest.json and its cut-out files, plus the bulb string's prepared mask), so every run is the same.
// The photo is the blurred lift input, so no unblurred person is ever shown. Stepped clock: lib.mjs. Clicks are marked: marker.mjs.
import { readFileSync } from 'node:fs';
import { openSession } from './lib.mjs';
import { installMarker } from './marker.mjs';
const [pw, out, clip, lifts, suggest, bulbsPng, base = 'http://localhost:5173'] = process.argv.slice(2);
const P = JSON.parse(readFileSync(new URL('./params/scene2.json', import.meta.url), 'utf8'));
const S = await openSession({ url: null, out, pw });
const p = S.p; await installMarker(p);
const sj = JSON.parse(readFileSync(`${suggest}/suggest.json`, 'utf8'));
const b64 = (f) => readFileSync(f).toString('base64');
const items = sj.items.map((i) => ({ label: i.label, score: i.score, box: i.box, cutout: b64(`${suggest}/${i.cutout_file}`) }));
items.push({ label: 'light bulbs', score: 0.88, box: P.bulbsBox, cutout: b64(bulbsPng) });
let polls = 0;
await p.route('**/api/segment', (route) => {
  const b = route.request().postDataJSON(); const j = (o, s = 200) => route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
  if (b.action === 'warm') return j({ ok: true });
  if (b.action === 'submit') { polls = 0; return j({ id: 'promo-SAM3-photo1' }); }
  polls++; return j(polls < 2 ? { state: 'running' } : { state: 'done', items, privacy: sj.privacy, seconds: sj.job_seconds });
});
await p.route('**/api/object-lift', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ perDay: 7, left: 7 }) }));
await p.goto(base + P.url);
await S.until(() => document.documentElement.dataset.ready === 'true', 'load');
await S.settle(1500); await S.hideChrome();
const photo = `${lifts}/${P.photoFile}`;
const upload = async () => { const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('#cfile')]); await fc.setFiles(photo); };
const clickAt = async (sel, sec = 0.5) => { await S.glideTo(sel, sec); await p.mouse.click(S.mx, S.my); };
// the Community page scrolls inside .com (the site bar stays fixed on top)
const pageScroll = (to, sec) => S.scrollTo('.com', to, sec);
if (clip === '2a') {
  // Explore first, then Make your own, then the file box and the photo appears
  S.mx = 900; S.my = 500;
  await S.rec(0.2); S.mark('explore');
  await clickAt('#make-own', 0.45); await S.rec(0.15); S.mark('makeOwn');
  { const bb = await p.locator('#cfile').boundingBox(); await S.glide(bb.x + 44, bb.y + bb.height / 2, 0.4); } S.mark('fileBox'); // the Choose File button is the left end of the input
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.mouse.click(S.mx, S.my)]); await S.rec(0.15);
  await fc.setFiles(photo);
  await S.until(() => !!document.querySelector('.stage img'), 'photo', 30000, true); S.mark('photo');
  await S.glide(760, 420, 0.3); await pageScroll(130, 0.5); await S.glide(820, 520, 0.4); S.mark('end');
} else {
  // 2b: set up unrecorded, then press Segment Objects, the outlines appear, point at some, pick a few
  await p.click('#make-own'); await upload(); await S.until(() => !!document.querySelector('.stage img'), 'photo', 30000);
  await S.settle(800); await p.evaluate(() => { document.querySelector('.com').scrollTop = 130; }); await S.settle(300); S.mx = 760; S.my = 300; await p.mouse.move(S.mx, S.my); S.n = 0;
  await S.rec(0.2); S.mark('start');
  await clickAt('#cseg', 0.45); S.mark('segment');
  await S.until(() => document.querySelectorAll('.stage .box').length > 1, 'outlines', 60000, true); S.mark('outlines');
  await S.rec(0.2);
  for (const [k, lab] of P.hover.entries()) {
    const idx = await p.evaluate((l) => [...document.querySelectorAll('.stage .box')].findIndex((e) => e.textContent.trim() === l), lab);
    if (idx < 0) continue; const sel = `.stage .box:nth-of-type(${idx + 1})`;
    await S.glideTo(sel, 0.4); await p.mouse.click(S.mx, S.my); await S.rec(0.2); S.mark('pick-' + lab + k);
  }
  await S.rec(0.3); S.mark('end');
}
await S.finish({ clip, params: P });
