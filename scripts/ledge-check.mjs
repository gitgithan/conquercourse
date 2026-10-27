// Runs the ideal bot at the default wall height and a taller one, and records how close the Rookie's hands get to the wall's top edge.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT ?? '5173';
const height = process.env.WALLH ?? '4.3';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/?bot=ideal&check=1&wallh=${height}`);
  await page.waitForSelector('html[data-ready=true]', { timeout: 120000 });
  await page.waitForFunction(() => document.documentElement.dataset.outcome === 'cleared' || document.documentElement.dataset.outcome === 'splash', null, { timeout: 400000, polling: 100 });
  const r = await page.evaluate(() => ({ outcome: document.documentElement.dataset.outcome, handErr: document.documentElement.dataset.handErr, pen: document.documentElement.dataset.maxPen }));
  console.log('wall height', height, r, 'errors:', errors);
  await browser.close();
  process.exit(r.outcome === 'cleared' && Number(r.handErr) < 0.2 && !errors.length ? 0 : 1);
} finally { server.kill(); }
