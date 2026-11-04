// Promo v2 segment: World Slicer (gallery, pick a place, slice, tilt) then the World Editor (rotate, fit, person, simulator, Design partner, top plan, Add pieces).
// usage: node slicer-editor.mjs <playwright> <outdir> [params.json] [baseUrl]
// Stepped clock (lib.mjs): one picture per step, true speed on a slow GPU. Real waits tick the clock and take no pictures.
import { readFileSync } from 'node:fs';
import { openSession } from './lib.mjs';
const [pw, out, pfile, base = 'http://localhost:5173'] = process.argv.slice(2);
const P = JSON.parse(readFileSync(pfile || new URL('./params/slicer-editor.json', import.meta.url), 'utf8'));
const S = await openSession({ url: null, out, pw });
const p = S.p;
// the Design partner reply: scripted stand-in in the live format (see params.designerStandIn)
await p.route('**/api/designer', async (route) => {
  let ids = [];
  try { ids = JSON.parse(JSON.parse(route.request().postData()).world).pieces.map((q) => q.id); } catch {}
  const edits = ids.slice(0, 2).map((id, i) => ({ piece: id, dz: i ? -0.8 : 0.9 }));
  const reply = 'The lane clears, so make it more interesting: slide the first two pieces a little so the gap before the middle bar asks for a real jump.\n```json\n' + JSON.stringify(edits) + '\n```';
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reply }) });
});
await p.goto(base + P.url);
await S.until(() => !!document.querySelector('#slice') || !!document.querySelector('.maplibregl-canvas'), 'load');
await S.settle(4000); await S.hideChrome();
// 1. the gallery of ready places
await S.glideTo('#ready-gallery-btn', 0.6);
await p.click('#ready-gallery-btn'); await S.settle(1200);
await S.rec(P.galleryHold); S.marks.gallery = S.n / S.fps;
const sc = await p.evaluate(() => { let e = document.querySelector('.card'); while (e && e.scrollHeight <= e.clientHeight + 10) e = e.parentElement; if (!e) return null; e.setAttribute('data-promo-scroll', '1'); return e.scrollHeight - e.clientHeight; });
if (sc) { await S.scrollTo('[data-promo-scroll]', Math.min(sc, 520), P.galleryScrollSecs); await S.scrollTo('[data-promo-scroll]', 0, 0.8); }
const card = p.locator('.card', { hasText: P.place }).first();
await card.scrollIntoViewIfNeeded(); await S.rec(0.2);
const bb = await card.boundingBox(); await S.glide(bb.x + bb.width / 2, bb.y + bb.height / 2, 0.8);
await p.mouse.click(S.mx, S.my); S.marks.place = S.n / S.fps;
// the map flies to the place: clock moves, no pictures; then the clip carries on
await S.settle(5500); await S.hideChrome();
await S.rec(P.afterPlaceSecs);
// 2. slice: the real flight plays by itself
await S.glideTo('#slice', 0.6); await p.click('#slice'); S.marks.slice = S.n / S.fps;
await S.until(() => document.documentElement.dataset.flightDone === '1', 'flight', 400000, true);
await S.rec(0.4); S.marks.flightDone = S.n / S.fps;
// 3. tilt the map with the real slider
await p.evaluate(() => document.querySelector('#tilt')?.scrollIntoView({ block: 'center' })); await S.rec(0.3);
await S.slide('#tilt', P.tiltTo, P.tiltSecs); await S.rec(0.4); S.marks.tilt = S.n / S.fps;
// 4. send it to the editor
await p.evaluate(() => document.querySelector('#buildpieces')?.scrollIntoView({ block: 'center' })); await S.rec(0.3);
await S.glideTo('#buildpieces', 0.6); S.marks.send = S.n / S.fps;
await p.click('#buildpieces');
await S.until(() => /mode=editor/.test(location.search) && document.documentElement.dataset.ready === 'true', 'editor', 180000);
await S.settle(3000); await S.hideChrome();
if (await p.isVisible('#glossaryhide')) await p.click('#glossaryhide');
if (await p.isVisible('#helper')) await p.click('#closehelper');
await S.settle(600);
// 5. editor: rotate around, fit, the start person
const box = await p.evaluate(() => { const r = document.querySelector('#view3d').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
await S.glide(box.x + box.w * 0.5, box.y + 90, 0.6);
await S.rec(0.5); S.marks.editor = S.n / S.fps;
await S.drag(P.orbitPx, 0, P.orbitSecs); S.marks.rotate = S.n / S.fps;
await S.glideTo('#fitview', 0.7); await p.click('#fitview'); await S.rec(P.fitHold); S.marks.fit = S.n / S.fps;
await S.glide(box.x + box.w * 0.35, box.y + box.h * 0.8, 0.8); await S.rec(P.personHold); S.marks.person = S.n / S.fps;
// 6. the simulator in a few states: find the best lane, turn the lane, check again
await S.glideTo('#best', 0.7); await p.click('#best'); await S.rec(P.simHold); S.marks.simBest = S.n / S.fps;
await S.glideTo('#lanepanel input[type=range], .aside input[type=range]', 0.6);
await S.slide('.aside input[type=range]', 60, 1.4); await S.rec(P.simHold); S.marks.simTurn = S.n / S.fps;
// 7. Design partner: ask, preview the suggested boxes
await S.glideTo('#helperbtn', 0.7); await p.click('#helperbtn'); await S.rec(0.8);
await S.glideTo('#what, #suggest', 0.6); await p.click('#what, #suggest', { timeout: 10000 }).catch(() => {});
await S.until(() => !!document.querySelector('#applyedits'), 'partner reply', 60000, true); await S.rec(0.8);
await S.glideTo('#applyedits', 0.6); await p.click('#applyedits'); await S.rec(P.partnerHold); S.marks.partner = S.n / S.fps;
await p.evaluate(() => document.querySelector('#closehelper')?.click()); await S.rec(0.5);
// 8. top view
await S.glideTo('#viewmode', 0.7); await p.click('#viewmode'); await S.rec(P.topPlanHold); S.marks.top = S.n / S.fps;
await p.click('#viewmode'); await S.rec(0.8);
// 9. Add pieces: open, tabs, scroll
await S.glideTo('#addpiece', 0.7); await p.click('#addpiece'); await S.rec(0.8); S.marks.add = S.n / S.fps;
for (const t of P.addTabs) { const loc = p.locator('.pb-tab', { hasText: t }).first(); if (await loc.count()) { const b = await loc.boundingBox(); await S.glide(b.x + b.width / 2, b.y + b.height / 2, 0.5); await loc.click(); await S.rec(0.9); } }
await p.locator('.pb-tab', { hasText: 'Real objects' }).first().click(); await S.rec(0.4);
await p.evaluate(() => { const c = document.querySelector('.pb-card'); let e = c; while (e && e.scrollHeight <= e.clientHeight + 10) e = e.parentElement; e?.setAttribute('data-promo-scroll2', '1'); });
if (await p.locator('[data-promo-scroll2]').count()) { await S.scrollTo('[data-promo-scroll2]', 900, P.addScrollSecs); await S.rec(0.4); }
S.marks.end = S.n / S.fps;
await S.finish({ params: P });
