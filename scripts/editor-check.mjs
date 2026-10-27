// Walks the World editor: the default world, a toy brick enlarged to a block, copy, crop, the best lane, and playing it.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const server = spawn('npx', ['vite', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  const errors = []; page.on('pageerror', (e) => { errors.push(e.message); console.log('PAGEERROR', e.message.slice(0, 200)); });
  await page.goto(`http://localhost:${port}/?mode=editor`);
  await page.waitForSelector('#plan', { timeout: 60000 });
  mkdirSync('test-results/editor', { recursive: true });
  const checks = {};
  const text = (sel) => page.textContent(sel);
  await page.waitForFunction(() => document.documentElement.dataset.verdict, null, { timeout: 20000 });
  checks.startsWithAWorld = Number(await page.evaluate(() => document.documentElement.dataset.pieces)) === 3;
  await page.screenshot({ path: 'test-results/editor/1-start.png' });
  // no vertical scrolling at common window sizes
  for (const [w, h] of [[1280, 720], [1024, 640], [1440, 900]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(400);
    const fits = await page.evaluate(() => { const e = document.querySelector('.ed'); return { root: e.scrollHeight <= e.clientHeight + 1, page: document.scrollingElement.scrollHeight <= innerHeight + 1, panels: [...document.querySelectorAll('.aside, .main')].every((n) => n.scrollHeight <= n.clientHeight + 1) }; });
    checks[`no scroll at ${w}x${h}`] = fits.root && fits.page && fits.panels;
    await page.screenshot({ path: `test-results/editor/layout-${w}x${h}.png` });
  }
  await page.setViewportSize({ width: 1300, height: 900 });
  // an object lifted from a real photo, placed at its real size
  await page.waitForSelector('button[data-object=railing-iron]', { timeout: 20000 });
  await page.click('button[data-object=railing-iron]');
  await page.waitForFunction(() => /railing-iron/.test(document.querySelector('#panel')?.textContent ?? ''), null, { timeout: 20000 });
  checks.photoObjectAtRealSize = /2\.52 × 0\.07 m, 1\.00 m high/.test(await text('#realsize'));
  await page.click('#del');
  // every object we have, one after the other: all load, the person is about 1.75 m, and the room is not scrolled
  const names = await page.$$eval('button[data-object]', (bs) => bs.map((b) => b.dataset.object));
  checks.allObjectsListed = names.length >= 8 && names.includes('rookie-a') && names.includes('stairs-park-07');
  const before = Number(await page.evaluate(() => document.documentElement.dataset.pieces));
  for (const [i, n] of names.entries()) { await page.click(`button[data-object=${n}]`); await page.waitForFunction((c) => Number(document.documentElement.dataset.pieces) >= c, before + i + 1, { timeout: 8000 }).catch(async () => { console.log('NOT PLACED', n, await page.evaluate(() => document.documentElement.dataset.verdict + ' | ' + document.documentElement.dataset.pieces)); }); }
  checks.allObjectsPlaced = Number(await page.evaluate(() => document.documentElement.dataset.pieces)) === before + names.length;
  await page.click('button[data-object=rookie-a]');
  await page.waitForFunction(() => /rookie-a/.test(document.querySelector('#panel')?.textContent ?? ''), null, { timeout: 20000 });
  checks.personIsPersonSized = /1\.[67]\d m high/.test(await text('#realsize'));
  await page.screenshot({ path: 'test-results/editor/all-objects.png' });
  await page.evaluate(() => localStorage.removeItem('cc.world.v1'));
  await page.reload();
  await page.waitForSelector('#plan', { timeout: 60000 });
  await page.waitForSelector('button[data-object=rookie-a]', { timeout: 20000 });
  // a toy brick: 3 cm, enlarged x15 to a half-metre block
  await page.click('text=Toy brick (3 cm)');
  checks.brickIsBlockSized = /0\.4\d × 0\.2\d m, 0\.1\d m high/.test(await text('#realsize'));
  await page.fill('#realheight', '0.5'); await page.dispatchEvent('#realheight', 'change');
  checks.realHeightSet = (await text('#realsize')).includes('0.50 m high');
  await page.click('#dup');
  checks.copied = Number(await page.evaluate(() => document.documentElement.dataset.pieces)) === 5 || (await page.$$('canvas')).length === 2;
  await page.click('#best');
  await page.waitForFunction(() => /simulator can clear/.test(document.documentElement.dataset.verdict ?? ''), null, { timeout: 30000 }).catch(() => {});
  checks.bestLaneClears = /simulator can clear/.test(await page.evaluate(() => document.documentElement.dataset.verdict ?? ''));
  await page.screenshot({ path: 'test-results/editor/2-best.png' });
  await page.click('#play');
  await page.waitForSelector('#keys', { timeout: 60000 });
  await page.waitForTimeout(1200);
  checks.playsTheLane = (await page.$('.ed')) === null && /m of/.test(await page.textContent('body'));
  await page.screenshot({ path: 'test-results/editor/3-play.png' });
  console.log(checks, 'errors:', errors);
  await browser.close();
  process.exit(Object.values(checks).every(Boolean) && !errors.length ? 0 : 1);
} finally { server.kill(); }
