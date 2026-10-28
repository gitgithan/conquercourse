// Real keys on the big drop demo with no roll: the landing is a hard landing and the Rookie crumples, lies still and gets up slowly (CC-77).
// Slow motion (timescale) so a software-rendered browser keeps up. Writes test-results/hurt-course-<n>.png. Usage: PORT=5483 node scripts/hurt-check.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const SCALE = 0.04;
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
let failed = false;
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/?course=/assets/demo/drop.course.json&timescale=${SCALE}`);
  await page.waitForFunction(() => document.documentElement.dataset.tick !== undefined, null, { timeout: 120000 });
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => document.documentElement.dataset.outcome === 'hurt', null, { timeout: 400000, polling: 50 });
  await page.keyboard.up('ArrowRight');
  const t0 = Number(await page.evaluate(() => document.documentElement.dataset.tick));
  mkdirSync('test-results', { recursive: true });
  const seen = [];
  for (const [k, dt] of [[0, 30], [1, 130], [2, 240], [3, 420], [4, 640], [5, 900]]) {
    await page.waitForFunction((t) => Number(document.documentElement.dataset.tick) >= t, t0 + dt, { timeout: 400000, polling: 50 });
    await page.screenshot({ path: `test-results/hurt-course-${k}.png` });
    seen.push(Number(await page.evaluate(() => document.documentElement.dataset.tick)) - t0);
  }
  console.log(JSON.stringify({ outcome: 'hurt', t0, shotsAtTicks: seen, errors }));
  failed = errors.length > 0;
  await browser.close();
} finally { server.kill(); }
process.exit(failed ? 1 : 0);
