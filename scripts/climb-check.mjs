// Real keys on the climb demo: run at the 2 m wall holding E, hang from the edge, pull up and stand on top (the 5 m drop after it is covered by roll-check).
// Slow motion (timescale) so a software-rendered browser can follow. Screenshots: hanging and pulling up. Usage: PORT=5471 node scripts/climb-check.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const SCALE = 0.05;
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const num = (page, k) => page.evaluate((k) => Number(document.documentElement.dataset[k]), k);
try {
  await new Promise((r) => setTimeout(r, 3000));
  mkdirSync('test-results/climb', { recursive: true });
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1100, height: 640 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/?course=/assets/demo/climb.course.json&timescale=${SCALE}`);
  await page.waitForFunction(() => document.documentElement.dataset.tick !== undefined, null, { timeout: 120000 });
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => Number(document.documentElement.dataset.x) > 21, null, { timeout: 300000, polling: 50 });
  await page.keyboard.down('KeyE'); // hold at the foot of the wall
  await page.waitForFunction(() => document.documentElement.dataset.mode === 'climb', null, { timeout: 120000, polling: 20 });
  const seen = { climbStartX: await num(page, 'x') };
  const t0 = await num(page, 'tick');
  await page.keyboard.up('ArrowRight'); // the run is over; only the hold key matters now
  await page.waitForFunction((t) => Number(document.documentElement.dataset.tick) >= t + 12, t0, { timeout: 120000, polling: 10 });
  await page.screenshot({ path: 'test-results/climb/1-hanging.png' });
  await page.waitForFunction((t) => Number(document.documentElement.dataset.tick) >= t + 62, t0, { timeout: 120000, polling: 10 });
  await page.screenshot({ path: 'test-results/climb/2-pulling.png' });
  await page.waitForFunction((t) => Number(document.documentElement.dataset.tick) >= t + 100, t0, { timeout: 120000, polling: 10 });
  await page.screenshot({ path: 'test-results/climb/3-over-the-edge.png' });
  await page.keyboard.up('KeyE');
  await page.waitForFunction(() => document.documentElement.dataset.mode === 'run' && document.documentElement.dataset.grounded === '1', null, { timeout: 120000, polling: 20 });
  await page.waitForTimeout(1500);
  seen.afterClimb = { x: await num(page, 'x'), grounded: await page.evaluate(() => document.documentElement.dataset.grounded), outcome: await page.evaluate(() => document.documentElement.dataset.outcome) };
  await page.screenshot({ path: 'test-results/climb/4-on-top.png' });
  seen.errors = errors;
  console.log(JSON.stringify(seen, null, 2));
  await browser.close();
} finally { server.kill(); }
