// Steps the game clock with the ideal bot and saves stills while the runner is on the warped wall (to look for body parts inside it).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const server = spawn('npx', ['vite', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const stepped = `(() => { let t = 0; performance.now = () => t; window.__stepClock = (ms) => { t += ms; return t; }; })();`;
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(stepped);
  await page.goto(`http://localhost:${port}/?bot=ideal`);
  await page.waitForSelector('html[data-ready=true]', { timeout: 120000 });
  mkdirSync('test-results/wall', { recursive: true });
  const step = (ms) => page.evaluate((m) => window.__stepClock(m), ms);
  for (let i = 0; i < 3000; i++) { await step(1000 / 30); if ((await page.evaluate(() => document.documentElement.dataset.mode)) === 'wall') break; }
  for (let i = 0; i < 12; i++) { await page.screenshot({ path: `test-results/wall/w${String(i).padStart(2, '0')}.png`, clip: { x: 340, y: 160, width: 600, height: 420 } }); for (let k = 0; k < 3; k++) await step(1000 / 30); }
  console.log('errors:', errors);
  await browser.close();
} finally { server.kill(); }
