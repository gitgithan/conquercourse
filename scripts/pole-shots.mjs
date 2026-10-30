// Screenshots for CC-239: the pole vault course (?pole=1): the pole carried, planted and the bar.
// Usage: node scripts/pole-shots.mjs   (writes test-results/pole/*.png)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', (e) => { errors.push(e.message); console.log('PAGEERROR', e.message.slice(0, 200)); });
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 300)); });
  mkdirSync('test-results/pole', { recursive: true });
  await page.goto(`http://localhost:${port}/?pole=1&welcome=0&nav=0`);
  await page.waitForSelector('html[data-ready=true]', { state: 'attached', timeout: 90000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-results/pole/start.png' });
  await page.keyboard.down('ArrowRight'); await page.keyboard.down('e');
  const releaseAt = Number(process.env.RELEASE ?? 99999);
  const t0 = Date.now();
  for (let i = 0; i < 40; i++) {
    if (Date.now() - t0 >= releaseAt) await page.keyboard.up('e');
    await page.screenshot({ path: `test-results/pole/t${String(i).padStart(2, '0')}.png` });
    await page.waitForTimeout(250);
  }
  console.log('errors:', errors);
  await browser.close();
  process.exit(errors.length ? 1 : 0);
} finally { server.kill(); }
