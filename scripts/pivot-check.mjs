// Pivot screenshots: the runner hangs still on the first bar of the lache demo at 0, 60, 120 and 180 degrees; the hands must be on the bar.
// Usage: node scripts/pivot-check.mjs   (PORT, LOOK=custom for the MHR body)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const errors = [];
  mkdirSync('test-results/pivot', { recursive: true });
  for (const deg of (process.env.DEGS ?? "0,60,120,180").split(",").map(Number)) {
    const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
    page.on('pageerror', (e) => { errors.push(e.message); console.log('PAGEERROR', e.message.slice(0, 200)); });
    await page.goto(`http://localhost:${port}/?course=/assets/demo/lache.course.json&hangtest=${(deg * Math.PI) / 180}&startx=38${process.env.LOOK ? `&look=${process.env.LOOK}` : ''}`);
    await page.waitForFunction(() => document.documentElement.dataset.tick !== undefined, null, { timeout: 120000 });
    await page.waitForTimeout(Number(process.env.WAIT ?? 10000));
    await page.keyboard.press('h'); await page.waitForTimeout(3000); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.screenshot({ path: `test-results/pivot/${process.env.LOOK ?? 'rookie'}-theta${deg}.png` });
    await page.close();
  }
  console.log('errors:', errors);
  await browser.close();
} finally { server.kill(); }
