// Records the Courses picker for the owner's cut (CC-209): the world gallery is shown, the Training course card is chosen, the course opens on its start line.
// Usage: PORT=5292 node scripts/film-picker.mjs [out.mp4]       (one browser at a time)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
const port = process.env.PORT ?? '5292', out = process.argv[2] ?? 'films/ui-picker.mp4';
const work = `${out}.frames`; rmSync(work, { recursive: true, force: true }); mkdirSync(work, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const marks = []; const log = (m) => console.log(new Date().toISOString().slice(11, 19), m);
let t0 = 0, browser, ctx;
try {
  await new Promise((r) => setTimeout(r, 3000));
  browser = await chromium.launch({ args: flags });
  ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: work, size: { width: 1280, height: 720 } } });
  const page = await ctx.newPage(); t0 = Date.now();
  page.setDefaultTimeout(12000); // no click may wait forever: a missing control must fail fast, not hang the take
  page.on('pageerror', (e) => log('PAGEERROR ' + e.message.slice(0, 160)));
  const mark = (n) => { marks.push([n, (Date.now() - t0) / 1000]); log(n); };
  await page.goto(`http://localhost:${port}/?welcome=0`);
  const card = page.getByText('Training course: every move').first();
  await card.waitFor({ timeout: 45000 }).catch(async () => { // the gallery may sit behind a Courses button
    log('card not visible yet; opening via the Courses button');
    await page.getByRole('button', { name: 'Courses' }).first().click();
    await card.waitFor({ timeout: 60000 });
  });
  mark('picker shown'); await page.waitForTimeout(2400);
  await card.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(600);
  await card.evaluate((el) => (el.closest('button') ?? el.closest('a') ?? el).dispatchEvent(new MouseEvent('click', { bubbles: true })));
  mark('training chosen');
  await page.waitForURL(/training/, { timeout: 60000 }).catch(() => log('url did not change: ' + page.url()));
  await page.waitForSelector('html[data-ready="true"]', { timeout: 120000 }).catch(() => log('course slow to be ready'));
  mark('training open'); await page.waitForTimeout(2600);
  await page.screenshot({ path: `${out}.training.png` });
  mark('end');
} catch (e) { log('threw ' + String(e).slice(0, 300)); }
// always close, or node stays alive holding the browser and the video never finalises
await ctx?.close().catch(() => {});
await browser?.close().catch(() => {});
server.kill();
writeFileSync(`${out}.marks.json`, JSON.stringify(marks, null, 2) + '\n');
console.log('video in', work, 'marks', JSON.stringify(marks));
process.exit(0);
