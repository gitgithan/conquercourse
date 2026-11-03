// Screenshots for CC-133: the fork course drawn with the real lifted objects, debug off, 1280 px desktop.
// Usage: node scripts/fork-real-shots.mjs   (writes test-results/fork-real/*.png)   TICKS=60,200,... to choose the moments
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const ticks = (process.env.TICKS ?? '1,200,300,400,500,650').split(',').map(Number);
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  await page.goto(`http://localhost:${port}/?course=/assets/demo/fork-bench-bulb.course.json&bot=ideal&welcome=0`);
  await page.waitForSelector('html[data-ready=true]', { state: 'attached', timeout: 180000 });
  mkdirSync('test-results/fork-real', { recursive: true });
  for (const t of ticks) {
    await page.waitForFunction((n) => Number(document.documentElement.dataset.tick) >= n, t, { timeout: 300000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `test-results/fork-real/tick-${String(t).padStart(4, '0')}.png` });
  }
  console.log('errors:', errors);
  await browser.close();
  process.exit(errors.length ? 1 : 0);
} finally { server.kill(); }
