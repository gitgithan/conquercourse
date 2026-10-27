// Plays the Course hands-free with the ideal line (?bot=ideal) and saves screenshots as it goes.
// Pass: the page reports outcome "cleared". Screenshots go to test-results/course-bot/.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const backend = process.argv[2] ?? 'webgpu';
const port = process.env.PORT ?? '5173';
const server = spawn('npx', ['vite', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader',
  '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://localhost:${port}/?bot=ideal&backend=${backend}`);
  await page.waitForSelector('html[data-ready=true]', { timeout: 120000 });
  mkdirSync('test-results/course-bot', { recursive: true });
  let shot = 0;
  const seen = new Set();
  const t0 = Date.now();
  while (Date.now() - t0 < 400000) {
    const d = await page.evaluate(() => ({ ...document.documentElement.dataset }));
    const key = `${d.mode}-${Math.floor(Number(d.tick) / 600)}`;
    if (!seen.has(key)) {
      seen.add(key);
      await page.screenshot({ path: `test-results/course-bot/${String(shot++).padStart(2, '0')}-t${d.tick}-${d.mode}.png` });
    }
    if (d.outcome !== 'running') {
      await page.waitForTimeout(500);
      await page.screenshot({ path: `test-results/course-bot/final-${d.outcome}.png` });
      console.log('outcome:', d.outcome, 'tick:', d.tick, 'errors:', errors.length);
      if (errors.length) console.log(errors.slice(0, 3));
      await browser.close();
      process.exit(d.outcome === 'cleared' ? 0 : 1);
    }
    await page.waitForTimeout(250);
  }
  console.log('timed out');
  await browser.close();
  process.exit(2);
} finally {
  server.kill();
}
