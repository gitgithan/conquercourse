// CC-247/248/249: the Community page end to end in a browser, with the API stubbed (no paid job runs):
// Explore (Make your own, Pieces people made), then Make your own in three steps (Photo, Pick, Make) with an uploaded photo, Segment Region, a click, Enter, and the Make step.
// Run: BASE=https://preview.conquercourse.pages.dev node scripts/communities-check.mjs out-dir   (without BASE it starts a local dev server on PORT)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
const port = process.env.PORT ?? '5301', out = process.argv[2] ?? 'test-results/communities';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? `http://localhost:${port}`;
const photo = 'public/assets/park/' + readdirSync('public/assets/park').find((f) => /\.jpe?g$/.test(f));
const server = process.env.BASE ? { kill() {} } : spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const checks = {};
try {
  if (!process.env.BASE) await new Promise((r) => setTimeout(r, 6000));
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  await page.route('**/api/segment', (route) => {
    const b = route.request().postDataJSON();
    route.fulfill({ json: b.action === 'submit' ? { id: 'fc-ABCDEFGHIJKL' } : { state: 'done', items: [{ label: 'bench', score: 0.9, box: [20, 20, 220, 160], cutout: png }, { label: 'wall', score: 0.8, box: [260, 40, 420, 200], cutout: png }], privacy: {}, seconds: 2 } });
  });
  await page.route('**/api/object-lift', (route) => { if (route.request().method() === 'GET') return route.fulfill({ json: { perDay: 7, left: 5 } }); return route.fulfill({ json: { error: 'off', message: 'off' }, status: 503 }); });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}/?mode=communities&welcome=0`, { timeout: 120000, waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', null, { timeout: 90000 });
  await page.waitForSelector('#objgrid', { timeout: 60000 }); await page.waitForTimeout(2000);
  await page.screenshot({ path: `${out}/1-explore.png` });
  checks.navMarked = await page.$eval('#sitenav [data-feature=community]', (e) => e.getAttribute('aria-current') === 'page');
  checks.exploreHasMakeOwnAndPieces = (await page.$('#make-own')) !== null && /Pieces people made/.test(await page.textContent('#ex-objects'));
  checks.searchBox = (await page.getAttribute('#shared-q', 'placeholder')) === 'Search pieces by name';
  checks.noKindFilterNoCourses = (await page.$('#shared-kind')) === null && (await page.$('#ex-courses')) === null;
  await page.click('#make-own'); await page.waitForSelector('#cfile');
  checks.threeSteps = (await page.$$eval('ol.steps button', (n) => n.map((x) => x.textContent))).join('|') === '1. Photo|2. Pick|3. Make';
  await page.setInputFiles('#cfile', photo);
  await page.waitForSelector('.stage img', { timeout: 20000 }); await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/2-pick-before.png` });
  checks.onPick = (await page.getAttribute('.panel', 'data-step')) === 'segment' && (await page.$('.stage .box')) === null;
  await page.click('#cseg'); await page.waitForSelector('.stage .box', { timeout: 30000 });
  checks.foundTwo = (await page.$$('.stage .box')).length === 2;
  checks.nextLocked = await page.$eval('#cnext', (e) => e.disabled);
  await page.click('.stage .box:nth-of-type(1)');
  checks.clickPicked = (await page.$$('.stage .box.sel')).length === 1 && !(await page.$eval('#cnext', (e) => e.disabled));
  await page.focus('.stage .box:nth-of-type(2)'); await page.keyboard.press('Enter');
  checks.enterPicked = (await page.$$('.stage .box.sel')).length === 2;
  await page.click('.stage .box:nth-of-type(2)');
  checks.clickAgainUnpicked = (await page.$$('.stage .box.sel')).length === 1;
  await page.screenshot({ path: `${out}/3-pick-picked.png` });
  checks.nextIsMake = (await page.textContent('#cnext')) === 'Next: Make';
  await page.click('#cnext'); await page.waitForSelector('.item');
  checks.oneItemWithName = (await page.$$('.item')).length === 1 && (await page.$('[id^=cname-]')) !== null && (await page.$('[id^=gen-]')) !== null;
  await page.screenshot({ path: `${out}/4-make.png` });
  checks.noChooseStep = (await page.$('#step-choose')) === null && (await page.$('[id^=choose-]')) === null;
  await page.click('#tab-explore'); await page.waitForSelector('#objgrid');
  checks.backToExplore = (await page.getAttribute('.com', 'data-tab')) === 'explore';
  console.log(checks, 'errors:', errors);
  const bad = Object.entries(checks).filter(([, v]) => v !== true).map(([k]) => k);
  if (bad.length || errors.length) { console.log('FAILED', bad); process.exitCode = 1; }
  await browser.close();
} finally { server.kill(); }
