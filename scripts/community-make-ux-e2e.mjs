// CC-247: the Make your own flow with the real Modal jobs, against a deployed site (the preview):
// upload a photo -> Segment Region -> tick two things -> make both -> prize turntable -> open the World Editor -> the piece is listed under "My pieces" and placed.
// Costs a little real GPU time (one segment job and two lifts). Run: BASE=https://preview.conquercourse.pages.dev node scripts/community-make-ux-e2e.mjs out-dir
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.env.BASE ?? 'https://preview.conquercourse.pages.dev', out = process.argv[2] ?? 'test-results/make-ux';
const photo = process.env.PHOTO ?? 'public/assets/park/park01.jpg';
mkdirSync(out, { recursive: true });
const log = []; const t0 = Date.now();
const say = (k, v = true) => { log.push({ step: k, ok: v, at: Math.round((Date.now() - t0) / 1000) }); console.log(k, v); };
const shot = (page, n) => page.screenshot({ path: `${out}/${n}.jpg`, type: 'jpeg', quality: 60 });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
// API_BASE: serve the page from BASE (for example a local dev server) but send every /api call to the deployed preview, so the Modal jobs are real
if (process.env.API_BASE) await page.route('**/api/**', (route) => { const u = new URL(route.request().url()); return route.fetch({ url: process.env.API_BASE + u.pathname + u.search, timeout: 0 }).then((res) => route.fulfill({ response: res })); });
let ok = false;
try {
  await page.goto(`${base}/?mode=communities&welcome=0&tab=make`, { timeout: 120000, waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#cfile', { timeout: 90000 });
  await page.setInputFiles('#cfile', photo);
  await page.waitForSelector('.stage img', { timeout: 30000 }); await page.waitForTimeout(600);
  say('on Segment', (await page.textContent('.panel .muted')).slice(0, 120));
  await shot(page, '1-segment-before');
  const tSeg = Date.now();
  await page.click('#cseg');
  await page.waitForFunction(() => document.querySelector('#cfound label') !== null, null, { timeout: 300000 });
  say('segment finished (seconds)', Math.round((Date.now() - tSeg) / 1000));
  const labels = await page.$$eval('#cfound label', (n) => n.map((x) => x.textContent));
  say('found things, in list order', labels);
  const again = await page.$$eval('#cfound label', (n) => n.map((x) => x.textContent));
  // hover over the second one: the list must not move, and the photo shows where it is
  await page.hover('#cfound label:nth-child(2)'); await page.waitForTimeout(200);
  const hl = (await page.$$('.stage .box.hl')).length;
  const after = await page.$$eval('#cfound label', (n) => n.map((x) => x.textContent));
  say('hover keeps the order and lights one box on the photo', JSON.stringify(after) === JSON.stringify(again) && hl === 1);
  await shot(page, '2-found-hover');
  // a click picks the first found thing, a click on another picks it too
  await page.click('.stage .box:nth-of-type(1)'); await page.click('.stage .box:nth-of-type(2)');
  say('ticked', await page.$$eval('#cfound input:checked', (n) => n.length));
  await page.click('#cnext'); await page.waitForSelector('[id^=choose-piece-]');
  const ids = await page.$$eval('.item', (n) => n.map((x) => x.dataset.id));
  for (const id of ids) { const v = await page.inputValue(`#cname-${id}`); if (!/^[a-z][a-z \-]{1,29}$/.test(v)) await page.fill(`#cname-${id}`, 'railing'); await page.click(`#choose-piece-${id}`); }
  await page.click('#cnext'); await page.waitForSelector('#make-all');
  say('make button', await page.textContent('#make-all'));
  await shot(page, '3-make');
  const tMake = Date.now();
  await page.click('#make-all');
  await page.waitForSelector('#prize[data-ready="1"]', { timeout: 600000 });
  say('first prize shown after seconds', Math.round((Date.now() - tMake) / 1000));
  const a1 = await page.getAttribute('#prize', 'data-turn'); await page.waitForTimeout(1500); const a2 = await page.getAttribute('#prize', 'data-turn');
  say('turntable turning', { motion: await page.getAttribute('#prize', 'data-motion'), a1, a2, moved: a1 !== a2 });
  await shot(page, '4-prize');
  const name1 = await page.textContent('#prize-name');
  const href = await page.getAttribute('#prize-editor', 'href');
  await page.click('#prize-keep'); await page.waitForSelector('#prize', { state: 'detached' });
  await page.waitForSelector('#prize[data-ready="1"]', { timeout: 600000 });
  say('second prize shown after seconds', Math.round((Date.now() - tMake) / 1000));
  await shot(page, '5-prize-second');
  // open the editor from the prize
  await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), page.click('#prize-editor')]);
  say('editor address', page.url().replace(base, ''));
  await page.waitForSelector('#addpiece', { timeout: 90000 }); await page.waitForTimeout(3000);
  const placed = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('cc.world.v1') ?? '{}').pieces.filter((p) => String(p.src).startsWith('user:')).length; } catch { return -1; } });
  say('pieces of mine placed in the world', placed);
  await page.click('#addpiece'); await page.waitForSelector('#pb-mine', { timeout: 10000 });
  const mineCards = await page.$$eval('#piecegrid .pb-card .pb-mine', (n) => n.length);
  say('cards under My pieces', mineCards);
  await shot(page, '6-editor-my-pieces');
  // another player's approved piece, if the store has one: add it to the list, see it under Shared pieces, place it
  const pick = await page.evaluate(async () => { const r = await fetch('/api/community-items'); const j = await r.json(); const it = (j.items ?? []).find((x) => x.kind === 'piece' && !x.mine && (!x.status || x.status === 'approved')); return it ? { id: it.id, name: it.name } : null; });
  let sharedOk = true;
  if (pick) {
    await page.evaluate((p) => localStorage.setItem('cc.shared-pieces', JSON.stringify([p])), pick);
    await page.goto(`${base}/?mode=editor&welcome=0&place=shared:${pick.id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#addpiece', { timeout: 90000 }); await page.waitForTimeout(4000);
    const n = await page.evaluate(() => (document.querySelector('#piecegrid')?.parentElement?.querySelectorAll('[data-piece^="shared-"]').length ?? 0) + document.querySelectorAll('[data-shared-piece]').length);
    const inWorld = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('cc.world.v1') ?? '{}').pieces.filter((p) => String(p.src).startsWith('shared:')).length; } catch { return -1; } });
    say('shared piece listed and placed', { n, inWorld, name: pick.name }); sharedOk = n >= 1 && inWorld >= 1;
  } else say('shared piece', 'no approved piece by another player in the store: not tested live');
  ok = placed >= 1 && mineCards >= 2 && sharedOk && errors.length === 0;
} catch (e) { say('FAILED', String(e).slice(0, 400)); await shot(page, 'failure').catch(() => undefined); }
writeFileSync(`${out}/run.json`, JSON.stringify({ base, ok, errors, log }, null, 2));
await browser.close();
process.exit(ok ? 0 : 1);
