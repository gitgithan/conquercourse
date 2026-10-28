// The speed vault on the lache demo: the bot runs at the box (front face at x = 22) and a picture is taken as the runner passes each x: plant, rise, over the edge, landing.
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
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  mkdirSync('test-results/vault', { recursive: true });
  await page.goto(`http://localhost:${port}/?course=/assets/demo/lache.course.json&bot=ideal&timescale=0.05`); // the game runs 20 times slower than the clock, so a picture can be taken at each mark
  await page.waitForSelector('html[data-ready=true]', { timeout: 120000 });
  await page.keyboard.press('h'); // the controls card away
  await page.waitForFunction(() => Number(document.documentElement.dataset.x) > 15, null, { timeout: 200000, polling: 50 });
  const marks = [18.4, 19.2, 20.0, 20.8, 21.5, 22.2, 22.9, 23.6];
  let next = 0, last = -1;
  const t0 = Date.now();
  while (next < marks.length && Date.now() - t0 < 240000) {
    const x = Number(await page.evaluate(() => document.documentElement.dataset.x));
    if (x >= marks[next]) { await page.screenshot({ path: `test-results/vault/v${String(next).padStart(2, '0')}-x${marks[next]}.png` }); next++; }
    last = x;
    await page.waitForTimeout(20);
  }
  console.log({ shots: next, lastX: last }, 'errors:', errors);
  await browser.close();
} finally { server.kill(); }
