// Screenshots for CC-156: the HUD (new and ?hud=old) over a bright sky, a dark tunnel and grass, at 1280 and 390 wide.
// The three backgrounds are flat colour backgrounds (the 3D picture hidden), so the worst cases are exact.
// Usage: node scripts/hud-shots.mjs   (writes test-results/hud/*.png)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--use-angle=swiftshader', '--ignore-gpu-blocklist'];
const backs = { sky: '#ffffff', tunnel: '#05070a', grass: '#4f8f33' };
const sizes = [[1280, 720], [390, 760]];
try {
  await new Promise((r) => setTimeout(r, 8000));
  const browser = await chromium.launch({ args: flags });
  mkdirSync('test-results/hud', { recursive: true });
  const errors = [];
  for (const hud of ['new', 'old']) for (const [width, height] of sizes) {
    const page = await browser.newPage({ viewport: { width, height } });
    page.on('pageerror', (e) => { errors.push(e.message); console.log('PAGEERROR', e.message.slice(0, 200)); });
    await page.goto(`http://localhost:${port}/?welcome=0&ghost=1${width < 600 ? '&touch=1' : ''}${hud === 'old' ? '&hud=old&gauges=old' : ''}`);
    await page.waitForSelector('#keys', { state: 'attached', timeout: 120000 });
    await page.waitForTimeout(3000);
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(1500);
    for (const [bn, colour] of Object.entries(backs)) {
      await page.evaluate((c) => { document.querySelectorAll('canvas').forEach((k) => { k.style.visibility = 'hidden'; }); document.body.style.background = c; document.documentElement.style.background = c; }, colour);
      await page.waitForTimeout(300);
      await page.screenshot({ path: `test-results/hud/${hud}-${bn}-${width}.png` });
      console.log('shot', hud, bn, width);
    }
    await page.close();
  }
  console.log('errors:', errors);
  await browser.close();
  process.exit(errors.length ? 1 : 0);
} finally { server.kill(); }
