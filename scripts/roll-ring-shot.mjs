// A picture of the debug view's orange roll ring and the X drum while falling off the drop demo's ledge. Usage: PORT=5474 node scripts/roll-ring-shot.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5474';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
try {
  await new Promise((r) => setTimeout(r, 4000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  mkdirSync('test-results/roll-ring', { recursive: true });
  await page.goto(`http://localhost:${port}/?course=/assets/demo/drop.course.json&bot=ideal&debug=1&timescale=0.15`);
  await page.waitForSelector('#debugbtn', { timeout: 60000 });
  let shot = 0;
  for (let i = 0; i < 600 && shot < 3; i++) {
    await page.waitForTimeout(150);
    const g = await page.evaluate(() => ({ grounded: document.documentElement.dataset.grounded, x: Number(document.documentElement.dataset.x), text: document.getElementById('debugpanel')?.innerText ?? '' }));
    if (g.grounded === '0' && g.x > 18.3 && /orange ring/.test(g.text)) { await page.screenshot({ path: `test-results/roll-ring/fall-${shot++}.png` }); await page.waitForTimeout(700); }
  }
  console.log('shots', shot);
  await browser.close();
} finally { server.kill(); }
