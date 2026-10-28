// Real keys on the big drop demo: run off the 5 m ledge; with a C tap just before the ground the run goes on, without it the landing is a hard landing.
// Slow motion (timescale) so a software-rendered browser can press at the right moment. Usage: PORT=5470 node scripts/roll-check.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT ?? '5173';
const SCALE = 0.2;
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const out = {};
  for (const roll of [true, false]) {
    const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://localhost:${port}/?course=/assets/demo/drop.course.json&timescale=${SCALE}`);
    await page.waitForFunction(() => document.documentElement.dataset.tick !== undefined, null, { timeout: 120000 });
    await page.keyboard.down('ArrowRight');
    await page.waitForFunction(() => Number(document.documentElement.dataset.x) > 18.05, null, { timeout: 300000, polling: 50 }); // off the ledge
    if (roll) {
      await page.waitForFunction(() => Number(document.documentElement.dataset.tick) >= 0 && document.documentElement.dataset.grounded === '0', null, { timeout: 60000, polling: 20 });
      const t0 = Number(await page.evaluate(() => document.documentElement.dataset.tick));
      // 5 m takes about 1 s (120 ticks); tap C at about 0.85 s, a fifth of a second before the ground
      await page.waitForFunction((t) => Number(document.documentElement.dataset.tick) >= t + 100, t0, { timeout: 300000, polling: 20 });
      await page.keyboard.press('KeyC');
    }
    await page.waitForFunction(() => ['running', 'cleared'].every(() => true) && (document.documentElement.dataset.grounded === '1' || document.documentElement.dataset.outcome !== 'running'), null, { timeout: 300000, polling: 50 }).catch(() => {});
    await page.waitForTimeout(roll ? 4000 : 1500);
    out[roll ? 'withRoll' : 'withoutRoll'] = { outcome: await page.evaluate(() => document.documentElement.dataset.outcome), x: await page.evaluate(() => document.documentElement.dataset.x), panel: (await page.textContent('body')).includes('Hard landing'), errors };
    if (!roll) await page.screenshot({ path: 'test-results/roll-hard-landing.png' });
    await page.close();
  }
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
} finally { server.kill(); }
