// Drags the mouse on the Course to turn the view around the runner, zooms with the wheel, then resets with a double-click.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const server = spawn('npx', ['vite', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/`);
  await page.waitForSelector('html[data-ready=true]', { timeout: 120000 });
  mkdirSync('test-results/orbit', { recursive: true });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/orbit/0-preset.png' });
  await page.mouse.move(640, 360); await page.mouse.down(); await page.mouse.move(400, 300, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(1800);
  await page.screenshot({ path: 'test-results/orbit/1-dragged.png' });
  await page.mouse.wheel(0, 400); await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/orbit/2-zoomed-out.png' });
  await page.mouse.dblclick(640, 400); await page.waitForTimeout(1800);
  await page.screenshot({ path: 'test-results/orbit/3-reset.png' });
  console.log('errors:', errors);
  await browser.close();
  process.exit(errors.length ? 1 : 0);
} finally { server.kill(); }
