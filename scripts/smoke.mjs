// Boots the page headless with WebGPU on SwiftShader and saves a screenshot to test-results/.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const backend = process.argv[2] ?? 'webgpu';
const server = spawn('npx', ['vite', '--port', '5173', '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader',
  '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.goto(`http://localhost:5173/?backend=${backend}`);
  await page.waitForSelector('html[data-ready=true]', { timeout: 90000 });
  await page.waitForTimeout(1500);
  mkdirSync('test-results', { recursive: true });
  await page.screenshot({ path: `test-results/skeleton-${backend}.png` });
  console.log('backend in use:', await page.evaluate(() => document.documentElement.dataset.backend));
  await browser.close();
} finally {
  server.kill();
}
