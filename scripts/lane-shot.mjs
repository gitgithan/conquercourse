// Opens a lane course (?course=...) and lets the ideal bot run it in slow motion, saving stills.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const lane = process.env.LANE ?? '/assets/demo/lane-1.course.json';
const server = spawn('npx', ['vite', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1100, height: 650 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/?course=${lane}&bot=ideal&timescale=0.2`);
  await page.waitForSelector('html[data-ready=true]', { timeout: 120000 });
  mkdirSync('test-results/lane', { recursive: true });
  await page.waitForFunction(() => Number(document.documentElement.dataset.tick) > 1, null, { timeout: 60000 });
  for (let i = 0; i < 8; i++) { await page.screenshot({ path: `test-results/lane/l${i}.png` }); await page.waitForTimeout(1800); }
  console.log('outcome', await page.evaluate(() => document.documentElement.dataset.outcome), 'errors:', errors);
  await browser.close();
} finally { server.kill(); }
