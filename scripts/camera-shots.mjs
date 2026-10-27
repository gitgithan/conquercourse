// Presses C to cycle the three cameras (side, 45 degrees, first person) while the ideal bot runs, and saves a shot of each.
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
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/?bot=ideal`);
  await page.waitForSelector('html[data-ready=true]', { timeout: 120000 });
  mkdirSync('test-results/cameras', { recursive: true });
  await page.waitForFunction((t) => Number(document.documentElement.dataset.tick) > t, Number(process.env.TICK ?? 400), { timeout: 240000 });
  for (const name of ['side', 'angle', 'first']) {
    await page.waitForTimeout(600);
    await page.screenshot({ path: `test-results/cameras/${name}.png` });
    await page.keyboard.press('KeyC');
  }
  console.log('errors:', errors);
  await browser.close();
  process.exit(errors.length ? 1 : 0);
} finally { server.kill(); }
