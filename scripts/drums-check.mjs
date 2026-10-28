// The drum lane: on by default wherever the course has a planned route (a built course and the stock course), G toggles it; drums slide toward the hit line as the runner closes in.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', (e) => { errors.push(e.message); console.log('PAGEERROR', e.message.slice(0, 200)); });
  mkdirSync('test-results/drums', { recursive: true });
  const checks = {};
  const lane = () => page.evaluate(() => { const d = document.getElementById('drums'); return d ? { shown: getComputedStyle(d).display !== 'none', drums: d.querySelectorAll('div[style*="radial"]').length } : null; });
  // a built course: the lane is on by itself
  await page.goto(`http://localhost:${port}/?course=/assets/demo/lane-1.course.json&startx=0`);
  await page.waitForSelector('#drums', { state: 'attached', timeout: 60000 });
  await page.waitForFunction(() => document.querySelectorAll('#drums div[style*="radial"]').length > 0, null, { timeout: 60000 });
  let l = await lane();
  checks.onForBuiltCourse = !!l?.shown && l.drums >= 2;
  await page.screenshot({ path: 'test-results/drums/built-start.png' });
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'test-results/drums/built-running.png' });
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('KeyG');
  checks.dTogglesOff = !(await lane()).shown;
  await page.keyboard.press('KeyG');
  checks.dTogglesOn = (await lane()).shown;
  // the stock course: on by itself too (it has a planned route); G hides it and shows it again
  await page.goto(`http://localhost:${port}/`);
  await page.waitForSelector('#drums', { state: 'attached', timeout: 60000 });
  await page.waitForFunction(() => document.querySelectorAll('#drums div[style*="radial"]').length > 0, null, { timeout: 90000 });
  checks.onForStockCourse = (await lane()).shown;
  await page.keyboard.press('KeyG');
  checks.stockHidesWithG = !(await lane()).shown;
  await page.keyboard.press('KeyG');
  checks.stockShowsAgainWithG = (await lane()).shown;
  await page.screenshot({ path: 'test-results/drums/stock.png' });
  console.log(checks, 'errors:', errors);
  if (errors.length || Object.values(checks).some((v) => !v)) process.exitCode = 1;
  await browser.close();
} finally { server.kill(); }
