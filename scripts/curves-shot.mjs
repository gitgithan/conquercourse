// Loads a course with curved-top obstacles (made by the Park fit), lets the ideal bot run it in slow motion and saves stills.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const course = readFileSync('test-results/curves-course.json', 'utf8');
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1100, height: 650 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.stack.split('\n').slice(0, 4).join(' | ')));
  await page.addInitScript((c) => sessionStorage.setItem('cc.resume', JSON.stringify({ course: JSON.parse(c), world: null, retryX: 0, facing: 1, falls: 0 })), course);
  await page.goto(`http://localhost:${port}/?bot=ideal&timescale=0.15`);
  await page.waitForSelector('html[data-ready=true]', { timeout: 120000 });
  mkdirSync('test-results/curves', { recursive: true });
  await page.waitForFunction(() => Number(document.documentElement.dataset.tick) > 1, null, { timeout: 60000 });
  for (let i = 0; i < 9; i++) { await page.screenshot({ path: `test-results/curves/c${i}.png` }); await page.waitForTimeout(1500); }
  console.log('outcome', await page.evaluate(() => document.documentElement.dataset.outcome), 'errors:', errors);
  await browser.close();
} finally { server.kill(); }
