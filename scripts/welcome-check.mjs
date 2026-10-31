// CC-246: the welcome screen. Opens it, hovers a tile, jumps in by click, and starts the First Course with a key.
//   PORT=5611 node scripts/welcome-check.mjs test-results/welcome      (screenshots: 1-welcome, 2-hover, 3-after-key)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const out = process.argv[2] ?? 'test-results/welcome';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
mkdirSync(out, { recursive: true });
const results = {}; const errors = [];
const ok = (k, v) => { results[k] = !!v; };
const base = `http://localhost:${port}/`;
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const open = async (url = '?welcome=1') => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base + url);
    await page.waitForSelector('#welcome-grid .wtile', { timeout: 60000 });
    return page;
  };

  let page = await open();
  ok('four tiles named like the top bar', JSON.stringify(await page.$$eval('.wtile b', (e) => e.map((x) => x.textContent))) === JSON.stringify(['Courses', 'World Editor', 'World Slicer', 'Community']));
  ok('tagline', (await page.textContent('#welcome-tag')) === 'Train slow. Run fast.');
  ok('the page painted before the 3D scene', await page.evaluate(() => !document.getElementById('welcome-scene')?.dataset.ready));
  await page.waitForFunction(() => document.getElementById('welcome-scene')?.dataset.ready === 'true', null, { timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/1-welcome.png` });
  const a = await page.screenshot({ clip: { x: 0, y: 0, width: 1280, height: 720 } });
  await page.waitForTimeout(1500);
  const b = await page.screenshot({ clip: { x: 0, y: 0, width: 1280, height: 720 } });
  ok('the background moves', !a.equals(b));

  const tile = page.locator('.wtile[data-feature=editor]');
  ok('highlights hidden before hover', await tile.locator('.wpop').evaluate((e) => getComputedStyle(e).visibility === 'hidden'));
  await tile.hover();
  await page.waitForFunction(() => { const e = document.querySelector('.wtile[data-feature=editor] .wpop'); return e && getComputedStyle(e).opacity === '1'; }, null, { timeout: 15000 }).catch(() => {}); // the software-drawn 3D scene is slow, so the fade can take a while
  const pop = await tile.locator('.wpop').evaluate((e) => ({ v: getComputedStyle(e).visibility, o: getComputedStyle(e).opacity, n: e.children.length }));
  ok('hover shows three highlights', pop.v === 'visible' && Number(pop.o) > 0.9 && pop.n === 3);
  if (!results['hover shows three highlights']) console.log('popup state', pop);
  await page.screenshot({ path: `${out}/2-hover.png` });
  await Promise.all([page.waitForURL(/mode=editor/), tile.click()]);
  ok('click on World Editor jumps in', page.url().includes('mode=editor'));
  await page.close();

  page = await open();
  await page.locator('.wtile[data-feature=courses]').click();
  await page.waitForSelector('#world-gallery', { timeout: 30000 });
  ok('Courses tile opens the gallery and stays here', !page.url().includes('mode=') && (await page.locator('#welcome').count()) === 1);
  await page.close();

  page = await open();
  await Promise.all([page.waitForURL(/welcome=0/), page.keyboard.press('x')]);
  ok('a key starts the First Course (not the Training course)', !page.url().includes('course=') && page.url().includes('welcome=0'));
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', null, { timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/3-after-key.png` });
  ok('the course page is up, no welcome screen', (await page.locator('#welcome').count()) === 0);
  await page.close();

  page = await open();
  await Promise.all([page.waitForURL(/welcome=0/), page.mouse.click(640, 700)]);
  ok('a click on the background starts the First Course', !page.url().includes('course='));
  await page.close();

  page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(base + '?mode=editor');
  ok('?mode=editor skips the welcome screen', (await page.locator('#welcome').count()) === 0);
  await page.close();

  page = await browser.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  await page.goto(base + '?welcome=1');
  await page.waitForFunction(() => document.getElementById('welcome-scene')?.dataset.ready === 'true', null, { timeout: 120000 });
  const r1 = await page.screenshot(); await page.waitForTimeout(1500); const r2 = await page.screenshot();
  ok('reduced motion freezes the pan', r1.equals(r2));
  await page.close();
  await browser.close();
} finally { server.kill(); }
console.log(JSON.stringify(results, null, 2));
if (errors.length) console.log('page errors:', errors.slice(0, 5));
process.exit(Object.values(results).every(Boolean) && !errors.length ? 0 : 1);
