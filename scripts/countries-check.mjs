// CC-108: the Countries tile at the top of the course picker at 1280 px, with 9 countries and with none yet (mocked numbers).
//   node scripts/countries-check.mjs   (screenshots in test-results/countries/)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const days = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(2026, 10, 1) - (11 - i) * 86400000).toISOString().slice(0, 10));
const curve = (a, b) => days.map((_, i) => Math.round(a + (b - a) * (i / 11)));
const daily = { days, series: { players: curve(2, 60), runs: curve(10, 400), assets: curve(0, 25), clears: curve(1, 90) } };
const world = (countries) => ({ players: 61, runs: 402, clears: 91, countries, totalClears: 900, busiest: 'Training', courses: {}, record: null, hardest: null });
const out = { errors: [] };
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => out.errors.push(e.message.slice(0, 160)));
  await page.route('**/api/daily-stats', (r) => r.fulfill({ json: daily }));
  mkdirSync('test-results/countries', { recursive: true });
  for (const [name, c] of [['nine', 9], ['zero', 0]]) {
    await page.route('**/api/world-stats', (r) => r.fulfill({ json: world(c) }));
    await page.goto(`http://localhost:${port}/`);
    await page.waitForSelector('#growth .gr-tile[data-metric=countries]', { timeout: 90000 });
    out[name] = { tile: await page.$eval('#growth .gr-tile[data-metric=countries]', (e) => e.innerText.replace(/\s+/g, ' ')), title: await page.$eval('#growth .gr-tile[data-metric=countries]', (e) => e.title), top: await page.$eval('#growth', (e) => Math.round(e.getBoundingClientRect().top)) };
    await page.screenshot({ path: `test-results/countries/${name}.png`, clip: { x: 0, y: 0, width: 1280, height: 420 } });
  }
  await browser.close();
} finally { server.kill(); }
console.log(JSON.stringify(out, null, 2));
