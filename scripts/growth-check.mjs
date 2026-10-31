// CC-108: the growth strip on the course picker at 1280 px. Mocks /api/daily-stats (and the world strip) and checks the chips, the menu and the range.
//   node scripts/growth-check.mjs   (screenshots in test-results/growth/; copy one to docs/evidence/)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
// 45 made-up days for the screenshot only (never in the shipped code)
const days = Array.from({ length: 45 }, (_, i) => new Date(Date.UTC(2026, 9, 31) - (44 - i) * 86400000).toISOString().slice(0, 10));
const curve = (a, b) => days.map((_, i) => Math.round(a + (b - a) * (i / 44) ** 2 + (i % 5)));
const daily = { days, series: { players: curve(2, 60), runs: curve(10, 400), assets: curve(0, 25), clears: curve(1, 90) } };
const out = { chips: [], afterChip: null, points: {}, errors: [], empty: null };
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => out.errors.push(e.message.slice(0, 160)));
  await page.route('**/api/world-stats', (r) => r.fulfill({ json: { players: 61, runs: 402, clears: 91, countries: 9, totalClears: 900, busiest: 'Training', courses: {}, record: null, hardest: null } }));
  await page.route('**/api/daily-stats', (r) => r.fulfill({ json: daily }));
  mkdirSync('test-results/growth', { recursive: true });
  await page.goto(`http://localhost:${port}/`);
  await page.waitForSelector('#growth .gr-chip', { timeout: 90000 });
  out.chips = await page.$$eval('#growth .gr-chip', (e) => e.map((x) => x.innerText.replace(/\s+/g, ' ')));
  out.collapsedHeight = await page.$eval('#growth', (e) => Math.round(e.getBoundingClientRect().height));
  await page.screenshot({ path: 'test-results/growth/collapsed.png' });
  await page.click('#growth .gr-chip[data-metric=runs]');
  await page.waitForSelector('#growth svg.gr-chart');
  const pts = () => page.$eval('#growth svg.gr-chart polyline', (p) => p.getAttribute('points').split(' ').length);
  out.points.runs30 = await pts();
  await page.click('#growth .gr-r button:nth-child(1)');
  out.points.runs7 = await pts();
  await page.click('#growth .gr-r button:nth-child(3)');
  out.points.runsAll = await pts();
  await page.selectOption('#growth select', 'assets');
  out.afterChip = await page.$eval('#growth .gr-sum', (e) => e.innerText);
  out.chartHeight = await page.$eval('#growth svg.gr-chart', (e) => Math.round(e.getBoundingClientRect().height));
  await page.click('#growth .gr-r button:nth-child(2)');
  await page.screenshot({ path: 'test-results/growth/expanded.png' });
  // a young game: the honest empty state
  await page.route('**/api/daily-stats', (r) => r.fulfill({ json: { days: ['2026-10-31'], series: { players: [0], runs: [0], assets: [0], clears: [0] } } }));
  await page.reload();
  await page.waitForSelector('#growth .gr-empty', { timeout: 90000 });
  out.empty = await page.$eval('#growth', (e) => e.innerText);
  await browser.close();
} finally { server.kill(); }
console.log(JSON.stringify(out, null, 1));
const ok = out.chips.length === 3 && out.points.runs7 === 7 && out.points.runs30 === 30 && out.points.runsAll === 45 && /Assets|day/.test(out.afterChip ?? '') && out.chartHeight <= 150 && /Just starting/.test(out.empty ?? '') && !out.errors.length;
process.exit(ok ? 0 : 1);
