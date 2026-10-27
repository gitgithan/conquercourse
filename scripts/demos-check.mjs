// Opens every course in the demo menu: it loads without errors and shows the runner and the menu; screenshots for a look.
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
  const errors = []; page.on('pageerror', (e) => { errors.push(e.message); console.log('PAGEERROR', e.message.slice(0, 160)); });
  mkdirSync('test-results/demos', { recursive: true });
  await page.goto(`http://localhost:${port}/`);
  await page.waitForSelector('#democourses', { timeout: 60000 });
  const options = await page.$$eval('#democourses option', (os) => os.map((o) => [o.value, o.textContent]));
  const checks = {};
  for (const [v, label] of options) {
    if (v === 'editor') continue;
    await page.goto(`http://localhost:${port}/${v ? `?course=${v}` : ''}`);
    await page.waitForSelector('#democourses', { timeout: 60000 });
    await page.waitForFunction(() => document.documentElement.dataset.tick !== undefined, null, { timeout: 60000 });
    await page.waitForTimeout(1200);
    checks[label] = /m of/.test(await page.textContent('body'));
    await page.screenshot({ path: `test-results/demos/${(v.split('/').pop() || 'stock').replace(/\W+/g, '_')}.png` });
  }
  console.log(checks, 'errors:', errors);
  await browser.close();
} finally { server.kill(); }
