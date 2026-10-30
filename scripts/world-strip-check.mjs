// CC-108: the world strip on the course picker. Mocks /api/world-stats and shows the first-run chooser (screenshot in test-results/world-strip/).
//   node scripts/world-strip-check.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const stats = { players: 1204, runs: 9310, clears: 311, countries: 14, totalClears: 5000, busiest: 'Training',
  courses: { 'demo/training': { runs: 400, clears: 87 } }, record: { course: 'circular-quay-sydney', nick: 'ACE', ticks: 3240 }, hardest: { course: 'Training', zone: 'lache-2', fails: 41 } };
const out = { strip: null, today: 0, errors: [] };
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => out.errors.push(e.message.slice(0, 160)));
  await page.route('**/api/world-stats', (r) => r.fulfill({ json: stats }));
  await page.addInitScript(() => localStorage.setItem('cc.streak', JSON.stringify({ last: new Date().toISOString().slice(0, 10), n: 3 })));
  mkdirSync('test-results/world-strip', { recursive: true });
  await page.goto(`http://localhost:${port}/`);
  await page.waitForSelector('#world-stats', { state: 'attached', timeout: 90000 });
  await page.waitForFunction(() => document.getElementById('world-stats')?.style.display !== 'none', null, { timeout: 20000 });
  out.strip = await page.$eval('#world-stats', (e) => e.innerText);
  out.today = await page.$$eval('.wg-today', (e) => e.length);
  await page.screenshot({ path: 'test-results/world-strip/picker.png' });
  await browser.close();
} finally { server.kill(); }
console.log(JSON.stringify(out, null, 1));
process.exit(out.strip && out.today >= 1 && !out.errors.length ? 0 : 1);
