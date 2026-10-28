// The coaster builder (?mode=coaster): drag the big hill up so the cart stalls, press Fix it, and the verdict says it rolls home; then Play it opens the Course.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  mkdirSync('test-results/coaster', { recursive: true });
  await page.goto(`http://localhost:${port}/?mode=coaster`);
  await page.waitForSelector('#cocanvas', { timeout: 60000 });
  const state = async () => JSON.parse(await page.evaluate(() => document.documentElement.dataset.coaster ?? 'null'));
  const result = { start: await state() };
  await page.screenshot({ path: 'test-results/coaster/builder-start.png' });
  const bb = await page.locator('#cocanvas').boundingBox();
  const k = bb.width / 1100;
  const at = (x, y) => [bb.x + (40 + (x / 64) * 1048) * k, bb.y + (410 - (y / 14) * 396) * k];
  const [x0, y0] = at(34, 3.6), [x1, y1] = at(34, 9);
  await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move(x1, y1, { steps: 8 }); await page.mouse.up();
  result.afterDrag = await state();
  await page.screenshot({ path: 'test-results/coaster/builder-stall.png' });
  await page.click('#cofix');
  result.afterFix = await state();
  result.fixText = await page.textContent('#costeps');
  await page.screenshot({ path: 'test-results/coaster/builder-fixed.png' });
  const href = await page.getAttribute('#coplay', 'href');
  await page.goto(`http://localhost:${port}/${href}&bot=ideal`);
  await page.waitForSelector('#debugbtn', { timeout: 60000 });
  let outcome = 'running';
  for (let i = 0; i < 60 && outcome === 'running'; i++) { await page.waitForTimeout(1000); outcome = await page.evaluate(() => document.documentElement.dataset.outcome ?? 'running'); }
  result.playOutcome = outcome;
  console.log(JSON.stringify(result), 'errors:', errors);
  await browser.close();
} finally { server.kill(); }
