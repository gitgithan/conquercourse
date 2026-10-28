// Opens every course in the demo menu: it loads without errors and shows the runner and the menu; screenshots for a look.
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
  const errors = []; page.on('pageerror', (e) => { errors.push(e.message); console.log('PAGEERROR', e.message.slice(0, 160)); });
  mkdirSync('test-results/demos', { recursive: true });
  await page.goto(`http://localhost:${port}/?welcome=0`);
  await page.waitForSelector('#courses-btn', { timeout: 60000 });
  await page.click('#courses-btn');
  const options = await page.$$eval('#world-gallery .wg-card', (cs) => cs.map((c) => [c.dataset.value, c.querySelector('b').textContent]));
  const checks = {};
  for (const [v, label] of options) {
    if (['editor', 'generate-same', 'coaster-builder', 'map', 'stay'].includes(v)) continue;
    if (v === 'generate') { await page.goto(`http://localhost:${port}/?generate=2`); await page.waitForSelector('#courses-btn', { timeout: 120000 }); await page.waitForFunction(() => document.documentElement.dataset.tick !== undefined, null, { timeout: 120000 }); await page.waitForTimeout(1200); checks[label] = /m of/.test(await page.textContent('body')); await page.screenshot({ path: 'test-results/demos/generated.png' }); continue; }
    await page.goto(`http://localhost:${port}/${v ? `?course=${v}` : '?welcome=0'}`);
    await page.waitForSelector('#courses-btn', { timeout: 60000 });
    await page.waitForFunction(() => document.documentElement.dataset.tick !== undefined, null, { timeout: 60000 });
    await page.waitForTimeout(1200);
    checks[label] = /m of/.test(await page.textContent('body')) && (await page.evaluate(() => { const f = document.getElementById('frontview'); return !!f && getComputedStyle(f).display !== 'none'; })); // loaded, and the front view is on
    await page.screenshot({ path: `test-results/demos/${(v.split('/').pop() || 'stock').replace(/\W+/g, '_')}.png` });
  }
  console.log(checks, 'errors:', errors);
  await browser.close();
} finally { server.kill(); }
