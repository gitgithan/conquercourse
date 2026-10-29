// Stills of the "Two ways" course on a stepped clock (CC-225): node scripts/ways-shots.mjs -> data/eval/two-ways/shots/*.png
// 1) fork approach with the strip and drum lane (?paths=1 and ?paths=0), 2) the end report after the ideal bot clears the course.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const stepped = `(() => { let t = 0; performance.now = () => t; window.__stepClock = (ms) => { t += ms; return t; }; })();`;
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const out = 'data/eval/two-ways/shots'; mkdirSync(out, { recursive: true });
const base = `http://localhost:${port}/?course=/assets/demo/two-ways.course.json`;
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  for (const [name, q] of [['fork-paths1', '&paths=1&startx=14'], ['fork-paths0', '&paths=0&startx=14'], ['report-paths1', '&paths=1&bot=ideal']]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(stepped);
    await page.goto(base + q);
    await page.waitForSelector('html[data-ready=true]', { timeout: 400000 });
    const step = (n) => page.evaluate(async (k) => { for (let i = 0; i < k; i++) { window.__stepClock(1000 / 60); await new Promise((r) => requestAnimationFrame(r)); } }, n);
    if (name.startsWith('report')) {
      for (let i = 0; i < 400; i++) { await step(30); if (await page.locator('#ways-table').count()) break; }
      await step(30);
    } else await step(40);
    await page.screenshot({ path: `${out}/${name}.png` });
    console.log(name, 'errors', errors, 'ways', await page.locator('#ways-table').count());
    await page.close();
  }
  await browser.close();
} finally { server.kill(); }
