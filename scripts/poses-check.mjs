// The pose gallery (CC-77): stepped frames of the seated rider, the sling, the giant swing at five angles and the hurt landing at six moments.
// Writes test-results/poses/<name>.png and prints what it saw. Usage: PORT=5481 node scripts/poses-check.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
let failed = false;
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 640, height: 520 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/?demo=poses`);
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', null, { timeout: 240000 });
  mkdirSync('test-results/poses', { recursive: true });
  const shot = async (name, call, ...args) => {
    await page.evaluate(([c, a]) => window.__poses[c](...a), [call, args]);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `test-results/poses/${name}.png` });
  };
  await shot('seated', 'seated');
  await shot('sling', 'sling');
  for (const [k, th] of [[0, 0], [1, 1.05], [2, 2.1], [3, 3.14], [4, -2.1]]) await shot(`swing-${k}`, 'swing', th, th === 0 ? 0 : 3);
  for (const [k, s] of [[0, 0.3], [1, 0.9], [2, 1.5], [3, 2.6], [4, 4.5], [5, 5.6]]) await shot(`hurt-${k}`, 'hurt', s);
  // the blind A/B of the hurt landing: both play, an answer reveals which was the clip and which the built fall
  await page.goto(`http://localhost:${port}/?demo=hurt-ab&freeze=1`);
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', null, { timeout: 240000 });
  const ab = await page.evaluate(() => {
    const api = window.__hurtAB;
    api.play('A'); api.play('B');
    const shown = [...document.querySelectorAll('button')].some((b) => /looked better/.test(b.textContent ?? ''));
    api.reply('A');
    return { map: api.map(), answerShown: shown, answered: document.documentElement.dataset.hurtAnswer, ticks: api.ticks() };
  });
  for (const label of ['A', 'B']) {
    await page.evaluate(([l, t]) => window.__hurtAB.show(l, t), [label, 150]);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `test-results/poses/hurt-ab-${label}.png` });
  }
  console.log(JSON.stringify({ errors, ab }));
  if (!ab.answerShown || !ab.answered) failed = true;
  failed = errors.length > 0;
  await browser.close();
} finally {
  server.kill();
}
process.exit(failed ? 1 : 0);
