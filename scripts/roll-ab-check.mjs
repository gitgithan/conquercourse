// The roll A/B page (CC-64): stepped frames of the roll, clip and tuck side by side, plus the answer flow.
// Writes test-results/roll-ab/{clip,tuck}-<n>.png and prints what it saw. Usage: PORT=5471 node scripts/roll-ab-check.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/?demo=roll-ab&freeze=1`);
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', null, { timeout: 180000 });
  const info = await page.evaluate(() => ({ map: window.__rollAB.map(), rolledAt: window.__rollAB.rolledAt(), ticks: window.__rollAB.ticks(), rollTicks: window.__rollAB.rollTicks(), note: document.body.innerText.slice(0, 120) }));
  mkdirSync('test-results/roll-ab', { recursive: true });
  const frames = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
  for (const label of ['A', 'B']) {
    const kind = info.map[label];
    for (let k = 0; k < frames.length; k++) {
      await page.evaluate(([l, t]) => window.__rollAB.show(l, t), [label, info.rolledAt + Math.round(frames[k] * (info.rollTicks - 1))]);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `test-results/roll-ab/${kind}-${k}.png` });
    }
  }
  // the answer flow: both played, then an answer reveals which was which
  await page.evaluate(() => { window.__rollAB.play('A'); window.__rollAB.play('B'); });
  const answerShown = await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => /looked better/.test(b.textContent ?? '')));
  await page.evaluate(() => window.__rollAB.reply('A'));
  const out = { ...info, answerShown, answered: await page.evaluate(() => document.documentElement.dataset.rollAnswer), errors };
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
} finally { server.kill(); }
