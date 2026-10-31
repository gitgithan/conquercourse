// CC-247: the whole Community upload path in a real browser against a deployed site (the preview), with the real Modal jobs:
// upload a photo -> Segment Region -> Choose -> Generate Piece -> Share -> see it in Explore as mine -> Delete (with confirm) -> gone.
// Then the same for a wallpaper. Pictures go to the folder given as the first argument. Run: BASE=https://preview.conquercourse.pages.dev node scripts/community-upload-e2e.mjs out-dir
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.env.BASE ?? 'https://preview.conquercourse.pages.dev', out = process.argv[2] ?? 'test-results/community-upload';
const photo = process.env.PHOTO ?? 'public/assets/park/park01.jpg'; // CC0 sample place (docs/ASSETS.md)
mkdirSync(out, { recursive: true });
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
  // Mark the railing (photo pixels 294,183 to 658,454 of 1024 x 760)
  const r = await page.$eval('.stage img', (e) => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
  await page.mouse.move(r.x + r.w * (294 / 1024), r.y + r.h * (183 / 760)); await page.mouse.down();
  await page.mouse.move(r.x + r.w * (658 / 1024), r.y + r.h * (454 / 760), { steps: 8 }); await page.mouse.up();
  await page.click('#cnext'); await page.waitForSelector('#cseg');
  say('marked and on Segment');
  await page.click('#cseg');
  await page.waitForFunction(() => document.querySelector('#chips .chip') !== null, null, { timeout: 240000 });
  const segText = await page.$eval('#cseginfo', (e) => e.textContent);
  say('segment region finished', segText);
  await shot(page, '2-segment');
  await page.click('#cnext'); await page.waitForSelector('[id^=choose-piece-]');
  await page.fill('[id^=cname-]', 'railing');
  await page.click('[id^=choose-piece-]');
  await page.click('#cnext');
  // Piece path
  await page.waitForSelector('[id^=gen-]');
  await page.click('[id^=gen-]');
  await page.waitForSelector('#cprog, [id^=gen-]');
  await page.waitForFunction(() => /Done in/.test(document.querySelector('[id^=cmsg-]')?.textContent ?? '') || document.querySelector('[id^=cmsg-]')?.className === 'err', null, { timeout: 600000 });
  const genText = await page.$eval('[id^=cmsg-]', (e) => e.textContent);
  say('generate piece', genText);
  await shot(page, '3-generated');
  if (!/Done in/.test(genText)) throw new Error('generate failed: ' + genText);
  await page.click('[id^=share-]:not([id^=share-note])');
  await page.waitForFunction(() => /Shared\./.test(document.querySelector('[id^=share-note-]')?.textContent ?? '') || document.querySelector('[id^=share-note-]')?.className === 'err', null, { timeout: 60000 });
  const shareText = await page.$eval('[id^=share-note-]', (e) => e.textContent);
  say('share piece', shareText);
  // Wallpaper path from the same mark: back to Choose, un-choose the piece, choose wallpaper
  await page.click('#step-choose'); await page.waitForSelector('[id^=choose-wall-]');
  await page.click('[id^=choose-piece-]'); await page.click('[id^=choose-wall-]'); await page.click('#cnext');
  await page.waitForSelector('[id^=wsave-]'); await page.fill('[id^=wname-]', 'skate park sky');
  await page.click('[id^=wsave-]'); await page.waitForSelector('[id^=share-]:not([id^=share-note])');
  await page.click('[id^=share-]:not([id^=share-note])');
  await page.waitForFunction(() => /Shared\./.test(document.querySelector('[id^=share-note-]')?.textContent ?? ''), null, { timeout: 60000 });
  say('share wallpaper', await page.$eval('[id^=share-note-]', (e) => e.textContent));
  await shot(page, '4-wallpaper-shared');
  // Explore: both should show as mine
  await page.click('#go-objects'); await page.waitForSelector('[data-shared]', { timeout: 30000 });
  const mine = await page.$$eval('[data-shared]', (n) => n.map((e) => ({ id: e.dataset.shared, kind: e.dataset.kind, text: e.textContent.slice(0, 80) })));
  say('gallery shows my items', mine);
  await page.evaluate(() => document.querySelector('#ex-objects')?.scrollIntoView());
  await shot(page, '5-gallery');
  const pubList = await api('/api/community-items');
  say('public list (no player code) item count', pubList.items?.length ?? pubList);
  // A different browser (no player code) cannot delete
  const other = await (await browser.newContext()).newPage(); await other.goto(`${base}/?mode=communities&welcome=0`, { waitUntil: 'domcontentloaded' });
  const stranger = await other.evaluate(async (id) => (await fetch('/api/community-items', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'delete', session: 'someone-else-123456', id }) })).status, mine[0].id);
  say('another player deleting my item gets', stranger);
  // Delete both with the confirm step
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
