// The drone ferry demo: the ideal-run bot boards the drone on the pad, flies it across the 40 m gap, sets down on the far deck and clears the course; screenshots on the way.
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
  mkdirSync('test-results/drone', { recursive: true });
  await page.goto(`http://localhost:${port}/?course=/assets/demo/drone.course.json&bot=ideal&debug=1`);
  await page.waitForSelector('#debugbtn', { timeout: 60000 });
  const checks = { sawBattery: false, sawDebugPreview: false, frontView: false };
  let shot = 0, cleared = false;
  for (let i = 0; i < Number(process.env.SECONDS ?? 90) && !cleared; i++) {
    await page.waitForTimeout(700);
    const body = await page.textContent('body');
    if (/Battery \d+%/.test(body)) { checks.sawBattery = true; checks.frontView ||= (await page.evaluate(() => { const e = document.getElementById('frontview'); return !!e && getComputedStyle(e).display !== 'none'; })); }
    if (/If you stop leaning and come down now/.test(body)) checks.sawDebugPreview = true;
    if (i % 3 === 0) await page.screenshot({ path: `test-results/drone/t${String(shot++).padStart(2, '0')}.png` });
    cleared = /You made it/.test(body);
  }
  await page.screenshot({ path: 'test-results/drone/end.png' });
  checks.cleared = cleared;
  console.log(checks, 'errors:', errors);
  await browser.close();
} finally { server.kill(); }
