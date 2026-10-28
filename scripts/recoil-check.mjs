// The recoil demo: the ideal-run bot runs onto the pad, jumps at the edge, fires the launcher (K) and clears the gap; screenshots at the pad, the shot and the landing.
// Usage: node scripts/recoil-check.mjs
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
  mkdirSync('test-results/recoil', { recursive: true });
  await page.goto(`http://localhost:${port}/?course=/assets/demo/recoil.course.json&bot=ideal`);
  await page.waitForSelector('#debugbtn', { timeout: 60000 });
  let sawPadHint = false, sawShot = false, cleared = false, shots = 0;
  for (let i = 0; i < Number(process.env.SECONDS ?? 60) * 2 && !cleared; i++) {
    await page.waitForTimeout(250);
    const body = await page.textContent('body');
    if (/clip the launcher on|Launcher on/.test(body) && !sawPadHint) { sawPadHint = true; await page.screenshot({ path: 'test-results/recoil/pad.png' }); }
    if (/Shot! The ball flies back/.test(body) && !sawShot) { sawShot = true; shots++; await page.screenshot({ path: 'test-results/recoil/shot.png' }); }
    cleared = /You made it/.test(body);
  }
  await page.screenshot({ path: 'test-results/recoil/end.png' });
  console.log({ sawPadHint, sawShot, cleared }, 'errors:', errors);
  await browser.close();
  process.exit(sawShot && cleared && !errors.length ? 0 : 1);
} finally { server.kill(); }
