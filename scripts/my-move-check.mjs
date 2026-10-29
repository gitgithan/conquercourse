// "My move" (CC-222): the Rookie plays the clip made from a person's film in the roll slot (?mymove=<id>), 1280 px wide.
// Writes test-results/my-move/game-<k>.png at even steps of the roll and prints whether the clip loaded.
// Usage: ID=roll-lp N=6 PORT=5473 node scripts/my-move-check.mjs   (copy the stills out before the next run)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const id = process.env.ID ?? 'roll-lp';
const n = Number(process.env.N ?? 6);
const diagnostic = process.env.DIAGNOSTIC === '1'; // a clip the checks refused is shown for diagnosis only: the answer is patched in this test, the game's guard is untouched
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
try {
  for (let i = 0; i < 60; i++) { try { await fetch(`http://localhost:${port}/`); break; } catch { await new Promise((r) => setTimeout(r, 1000)); } }
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  if (diagnostic) {
    await page.route(`**/assets/experiments/mymove/${id}.json`, async (route) => {
      const raw = await (await route.fetch()).json();
      await route.fulfill({ json: { ...raw, playable: true, gate: { pass: true }, move_check: { ok: true } } });
    });
  }
  await page.goto(`http://localhost:${port}/?demo=roll-ab&freeze=1&mymove=${id}`);
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', null, { timeout: 240000 });
  const info = await page.evaluate(() => ({ myMove: window.__rollAB.myMove, map: window.__rollAB.map(), rolledAt: window.__rollAB.rolledAt(), rollTicks: window.__rollAB.rollTicks() }));
  mkdirSync('test-results/my-move', { recursive: true });
  const label = Object.entries(info.map).find(([, v]) => v === 'clip')[0];
  for (let k = 0; k < n; k++) {
    const tick = info.rolledAt + Math.round((k / (n - 1)) * (info.rollTicks - 1));
    await page.evaluate(([l, t]) => window.__rollAB.show(l, t), [label, tick]);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `test-results/my-move/game-${k}.png` });
  }
  console.log(JSON.stringify({ id, info, errors }));
  await browser.close();
} finally { server.kill(); }
