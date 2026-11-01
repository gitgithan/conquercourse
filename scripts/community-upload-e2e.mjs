// CC-247/249: the whole Community upload path in a real browser against a deployed site (the preview), with the real Modal jobs:
// upload a photo -> Pick (Segment Region, click a thing) -> Make (name it, Generate Piece) -> Share -> see it in Explore as mine -> Delete (with confirm) -> gone.
// COSTS REAL GPU TIME (one segment job and one lift), so it only runs with PAID=1. Pictures go to the folder given as the first argument.
// Run: PAID=1 BASE=https://preview.conquercourse.pages.dev node scripts/community-upload-e2e.mjs out-dir
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.env.BASE ?? 'https://preview.conquercourse.pages.dev', out = process.argv[2] ?? 'test-results/community-upload';
const photo = process.env.PHOTO ?? 'public/assets/park/park01.jpg'; // CC0 sample place (docs/ASSETS.md)
mkdirSync(out, { recursive: true });
if (process.env.PAID !== '1') { console.log('This check starts paid GPU jobs. Run it with PAID=1 to go on.'); process.exit(2); }
const log = []; const t0 = Date.now();
const say = (k, v = true) => { log.push({ step: k, ok: v, at: Math.round((Date.now() - t0) / 1000) }); console.log(k, v); };
const shot = (page, n) => page.screenshot({ path: `${out}/${n}.jpg`, type: 'jpeg', quality: 72 });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
const api = (path, headers = {}) => page.evaluate(async ([p, h]) => { const r = await fetch(p, { headers: h }); return r.ok ? r.json() : { status: r.status }; }, [path, headers]);
let ok = false;
try {
  await page.goto(`${base}/?mode=communities&welcome=0&tab=make`, { timeout: 120000, waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#cfile', { timeout: 90000 });
  await page.setInputFiles('#cfile', photo);
  await page.waitForSelector('.stage img', { timeout: 30000 }); await page.waitForTimeout(600);
  say('uploaded photo');
  await shot(page, '1-upload');
  say('on Pick');
  await page.click('#cseg');
  await page.waitForSelector('.stage .box', { timeout: 240000 });
  await page.click('.stage .box'); // a click picks the first found thing
  const segText = await page.$eval('#cseginfo', (e) => e.textContent);
  say('segment region finished', segText);
  await shot(page, '2-segment');
  await page.click('#cnext'); await page.waitForSelector('[id^=cname-]'); // Next: Make
  await page.fill('[id^=cname-]', 'railing');
  await page.waitForSelector('[id^=gen-]');
  await page.click('[id^=gen-]');
  await page.waitForSelector('#cprog, [id^=gen-]');
  await page.waitForFunction(() => /Done in/.test(document.querySelector('[id^=cmsg-]')?.textContent ?? '') || document.querySelector('[id^=cmsg-]')?.className === 'err', null, { timeout: 600000 });
  const genText = await page.$eval('[id^=cmsg-]', (e) => e.textContent);
  say('generate piece', genText);
  await shot(page, '3-generated');
  if (!/Done in/.test(genText)) throw new Error('generate failed: ' + genText);
  if (await page.$('#prize-keep')) await page.click('#prize-keep'); // the prize turntable sits on top until it is kept
  await page.waitForSelector('[id^=share-]:not([id^=share-note])');
  await page.click('[id^=share-]:not([id^=share-note])');
  await page.waitForFunction(() => /Shared\./.test(document.querySelector('[id^=share-note-]')?.textContent ?? '') || document.querySelector('[id^=share-note-]')?.className === 'err', null, { timeout: 60000 });
  const shareText = await page.$eval('[id^=share-note-]', (e) => e.textContent);
  say('share piece', shareText);
  // Explore: it should show as mine
  await page.click('#go-objects'); await page.waitForSelector('[data-shared]', { timeout: 30000 });
  const mine = await page.$$eval('[data-shared]', (n) => n.map((e) => ({ id: e.dataset.shared, kind: e.dataset.kind, text: e.textContent.slice(0, 80) })));
  say('Explore shows my item', mine);
  say('my item has Look around / Use buttons, or Delete only', await page.$$eval('[data-shared] button', (n) => n.map((b) => b.id.replace(/-[a-z0-9]{10}$/, ''))));
  await page.evaluate(() => document.querySelector('#ex-objects')?.scrollIntoView());
  await shot(page, '5-gallery');
  const pubList = await api('/api/community-items');
  say('public list (no player code) item count', pubList.items?.length ?? pubList);
  // A different browser (no player code) cannot delete
  const other = await (await browser.newContext()).newPage(); await other.goto(`${base}/?mode=communities&welcome=0`, { waitUntil: 'domcontentloaded' });
  const stranger = await other.evaluate(async (id) => (await fetch('/api/community-items', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'delete', session: 'someone-else-123456', id }) })).status, mine[0].id);
  say('another player deleting my item gets', stranger);
  // Delete it with the confirm step
  for (const m of mine) {
    await page.click(`#del-${m.id}`);
    if (m === mine[0]) { await page.waitForSelector(`#del-yes-${m.id}`); await shot(page, '6-delete-confirm'); await page.click(`#del-no-${m.id}`); await page.click(`#del-${m.id}`); }
    await page.click(`#del-yes-${m.id}`);
    await page.waitForSelector(`[data-shared="${m.id}"]`, { state: 'detached', timeout: 30000 });
  }
  say('deleted with the confirm step');
  await page.goto(`${base}/?mode=communities&welcome=0`, { waitUntil: 'domcontentloaded' }); await page.waitForSelector('#objgrid', { timeout: 60000 }); await page.waitForTimeout(2500);
  const left = await page.$$eval('[data-shared]', (n) => n.length);
  const after = await api('/api/community-items', { 'x-cc-session': await page.evaluate(() => localStorage.getItem('cc.session')) });
  say('after reload: my shared cards', left); say('after delete: list still has my ids', (after.items ?? []).filter((i) => mine.some((m) => m.id === i.id)).length);
  const gone = await api(`/api/community-items?id=${mine[0].id}&file=thumb`);
  say('the file of a deleted item', gone.status);
  await page.evaluate(() => document.querySelector('#ex-objects')?.scrollIntoView());
  await shot(page, '7-gone');
  ok = left === 0 && stranger === 404;
} catch (e) { say('FAILED', String(e).slice(0, 400)); await shot(page, 'failure').catch(() => undefined); }
writeFileSync(`${out}/run.json`, JSON.stringify({ base, ok, errors, log }, null, 2));
await browser.close();
process.exit(ok ? 0 : 1);
