// Runs the ideal bot over the whole Course and reports the deepest any joint of the Rookie gets inside a block or the wall.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT ?? '5173';
const server = spawn('npx', ['vite', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/?bot=ideal&check=1${process.env.NOPUSH ? '&nopush=1' : ''}`);
  await page.waitForSelector('html[data-ready=true]', { timeout: 120000 });
  await page.waitForFunction(() => document.documentElement.dataset.outcome === 'cleared', null, { timeout: 400000, polling: 100 });
  const pen = Number(await page.evaluate(() => document.documentElement.dataset.maxPen));
  console.log('where:', await page.evaluate(() => document.documentElement.dataset.maxPenWhere));
  console.log('deepest overlap (m, measured against the surface itself, no margin):', pen, 'errors:', errors);
  await browser.close();
  process.exit(pen < 0.2 && !errors.length ? 0 : 1);
} finally { server.kill(); }
