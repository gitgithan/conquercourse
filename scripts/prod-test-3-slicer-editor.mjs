// CC-133 checks 4, 5: World Slicer (Shibuya) -> street-photo dot -> Send to the World Editor -> editor tabs.
// The design partner (real model call) runs only with ASK_AI=1 and only once.
import { start, newPage } from './prod-test-lib.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const [base, out] = [process.argv[2], process.argv[3]]; mkdirSync(out, { recursive: true });
const tag = (base.includes('preview') ? 'preview' : 'prod') + (process.env.TAGX ?? ''), log = {}, res = {}, b = await start();
async function step(name, fn) { try { res[name] = await fn(); } catch (e) { res[name] = 'ERROR ' + e.message.slice(0, 250); } console.log(name, JSON.stringify(res[name])); }
const { page } = await newPage(b, log, 'slicer'); page.setDefaultTimeout(90000);
page.on('dialog', (d) => d.accept());
let lane = null;
await step('gallery', async () => { await page.goto(base + '/?mode=map&welcome=0&hooks=1' + (process.env.EXTRA ?? '')); await page.waitForSelector('html[data-ready=true]'); await page.getByRole('button', { name: /Browse \d+ ready places/ }).click(); await page.waitForTimeout(3000);
  const r = { cards: await page.$$eval('button[data-slug]', (e) => e.map((x) => x.dataset.slug)), shibuya: !!(await page.$('button[data-slug="shibuya-tokyo"]')) };
  await page.screenshot({ path: `${out}/${tag}-slicer-gallery.png` }); return r; });
await step('pick-slice', async () => { await page.click('button[data-slug="shibuya-tokyo"]'); await page.waitForSelector('#slice:not([disabled])', { timeout: 90000 });
  const tilt = await page.inputValue('#tilt'); await page.click('#slice');
  await page.waitForFunction(() => document.documentElement.dataset.sliceLane && document.documentElement.dataset.sliceLane !== 'working', null, { timeout: 120000 }).catch(() => {});
  await page.waitForFunction(() => document.documentElement.dataset.flightDone === '1', null, { timeout: 90000 }).catch(() => {}); await page.waitForTimeout(3000);
  return { tiltDefault: tilt, tiltAfterFlight: await page.inputValue('#tilt'), mapPitch: await page.evaluate(() => Math.round(window.__ccMap?.map.getPitch() ?? -1)), flightDone: await page.evaluate(() => document.documentElement.dataset.flightDone), lane: await page.evaluate(() => document.documentElement.dataset.sliceLane), photodotsAttr: await page.evaluate(() => document.querySelector('#map')?.dataset.photodots ?? document.querySelector('.maplibregl-map')?.dataset.photodots) }; });
await step('photo-dot', async () => { const calls = []; page.on('response', (r) => { if (/\/api\/(photos|features)/.test(r.url())) calls.push(r.status() + ' ' + new URL(r.url()).pathname); });
  const list = await (await fetch(base + '/assets/photos-live/shibuya-tokyo.json')).json();
  const pos = await page.evaluate((photos) => { const m = window.__ccMap?.map; if (!m) return { err: 'no __ccMap' }; const c = m.getCanvas().getBoundingClientRect(); const inView = photos.map((p) => { const q = m.project([p.lon, p.lat]); return { x: c.x + q.x, y: c.y + q.y }; }).filter((q) => q.x > c.x + 20 && q.x < c.right - 20 && q.y > c.y + 80 && q.y < c.bottom - 20); if (!inView.length) return { err: 'no photo dot in view', zoom: m.getZoom(), pitch: m.getPitch(), photodots: m.getContainer().dataset.photodots }; return { ...inView[0], n: inView.length }; }, list.photos);
  if (pos.err) return pos;
  await page.mouse.click(pos.x, pos.y); await page.waitForTimeout(500);
  const ok = await page.waitForFunction(() => { const p = document.getElementById('photodotpanel'); return p && !p.hidden && !!p.querySelector('img'); }, null, { timeout: 40000 }).then(() => true).catch(() => false);
  const panelText = await page.evaluate(() => document.getElementById('photodotpanel')?.innerText.replace(/\s+/g, ' ').slice(0, 200));
  const img = ok ? await page.evaluate(() => { const i = document.querySelector('#photodotpanel img'); return new Promise((res) => { if (i.complete) res(i.naturalWidth); else { i.onload = () => res(i.naturalWidth); i.onerror = () => res(-1); setTimeout(() => res(-2), 15000); } }); }) : null;
  await page.screenshot({ path: `${out}/${tag}-slicer-photo.png` }); return { dotsRendered: pos.n, panelOpen: ok, panelText, imageNaturalWidth: img, apiCalls: calls }; });
await step('send-to-editor', async () => { await page.click('#buildpieces'); await page.waitForFunction(() => new URLSearchParams(location.search).get('mode') === 'editor', null, { timeout: 90000 });
  await page.waitForFunction(() => document.documentElement.dataset.lane, null, { timeout: 90000 });
  const l = JSON.parse(await page.evaluate(() => document.documentElement.dataset.lane)); return { url: page.url().replace(base, '').slice(0, 80), laneKeys: Object.keys(l).slice(0, 8), pieces: await page.evaluate(() => document.documentElement.dataset.pieces) }; });
await step('editor-tabs', async () => { await page.waitForSelector('#view3d'); await page.waitForTimeout(3000);
  const tabs = await page.$$eval('button', (e) => e.map((x) => x.id + '|' + x.textContent.trim().slice(0, 22)).filter((s) => /add|move|improve|top|ask|view|piece/i.test(s)));
  const r = { tabs, clicked: {} };
  for (const name of ['Add pieces', 'Moves', 'Improve', 'Top view']) { const el = page.getByRole('button', { name: new RegExp(name, 'i') }).first(); const n = await el.count(); if (!n) { r.clicked[name] = 'not found'; continue; } await el.click().catch((e) => (r.clicked[name] = 'click failed')); await page.waitForTimeout(1200); r.clicked[name] = r.clicked[name] ?? (await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 120))); }
  await page.screenshot({ path: `${out}/${tag}-editor.png` }); return r; });
writeFileSync(`${out}/${tag}-3-slicer-editor.json`, JSON.stringify({ res, log }, null, 2)); await b.close();
