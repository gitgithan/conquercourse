// CC-133: the Monkey bars piece in the World Editor (?bars=1): place a bar then a row of bars, show the editor, then play the lane in the Course.
// Usage: node scripts/bars-editor-shot.mjs [outDir]  (1280 x 720, one browser; run it on a VM)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5471', out = process.argv[2] ?? 'test-results/bars-editor';
mkdirSync(out, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const errors = [];
try {
  await new Promise((r) => setTimeout(r, 5000));
  const browser = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  page.setDefaultTimeout(60000);
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)));
  await page.goto(`http://localhost:${port}/?mode=editor&bars=1&welcome=0`);
  await page.waitForSelector('#addpiece', { timeout: 120000 });
  await page.waitForTimeout(3000);
  if (await page.isVisible('#edglossary').catch(() => false)) await page.click('#glossaryhide');
  console.log('buttons', await page.evaluate(() => ['addbars', 'addbarbars', 'fitbars', 'play'].map((i) => i + ':' + !!document.getElementById(i))));
  await page.screenshot({ path: `${out}/1-editor-start.png` });
  // the starter pieces stay: they are the ground the row hangs over
  await page.click('#addpiece').catch(() => {});
  await page.waitForSelector('#addbarbars', { state: 'attached' });
  await page.$eval('#addbarbars', (e) => e.click());
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/2-bar-then-bars.png` });
  console.log('pieces', await page.evaluate(() => document.documentElement.dataset.pieces), 'bars', await page.evaluate(() => document.documentElement.dataset.bars));
  const body = await page.evaluate(() => document.body.innerText);
  console.log('panel', body.split('\n').filter((l) => /rung|bars|hold E|Rungs|Spacing|Height/i.test(l)).slice(0, 8).join(' | '));
  await page.waitForSelector('#play', { state: 'visible', timeout: 60000 }).catch(() => console.log('no #play visible'));
  await page.screenshot({ path: `${out}/3-before-play.png` });
  await page.$eval('#play', (e) => e.click());
  await page.waitForFunction(() => !location.search.includes('mode=editor') || document.querySelector('[data-mode=course], #hud, canvas[data-course]'), null, { timeout: 420000 }).catch(() => console.log('still in the editor'));
  await page.waitForSelector('html[data-ready=true]', { timeout: 240000 });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${out}/4-course-from-editor.png` });
  console.log('mode after play', await page.evaluate(() => location.search.slice(0, 80) + ' x=' + document.documentElement.dataset.x));
  console.log('errors', JSON.stringify(errors));
  await browser.close();
} finally { server.kill(); }
