// Usage: PORT=5480 SEED=2 node scripts/restart-check.mjs   (CC-69)
// Plays a generated course badly on purpose (run, tap Space now and then, fall), and measures how long the page's main thread is blocked
// when the fall panel appears and when the player restarts. A frozen page shows as a long gap between two heartbeats.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT ?? String(20000 + Math.floor(Math.random() * 20000)), seed = process.env.SEED ?? '2', maxWaitS = Number(process.env.MAXWAIT ?? 200);
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const out = {};
try {
  await new Promise((r) => setTimeout(r, 3000));
  // make sure the server answering is this tree's own (a busy port would be some other worktree's server)
  const served = await (await fetch(`http://localhost:${port}/src/modes/course.ts`)).text();
  console.log('served code has the stored-windows tip:', served.includes('windowTip'));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 200)));
  const t0 = Date.now();
  await page.goto(`http://localhost:${port}/?generate=${seed}`);
  await page.waitForSelector('canvas', { timeout: 120000 });
  await page.waitForFunction(() => document.documentElement.dataset.x !== undefined, null, { timeout: 120000 });
  out.loadMs = Date.now() - t0;
  // a heartbeat: the longest gap between two 20 ms ticks is the longest the main thread was blocked
  await page.evaluate(() => { const w = window; w.__gap = 0; w.__gaps = []; w.__t0 = performance.now(); w.__last = performance.now(); setInterval(() => { const n = performance.now(); if (n - w.__last > 1000) w.__gaps.push([Math.round((n - w.__t0) / 100) / 10, Math.round(n - w.__last)]); w.__gap = Math.max(w.__gap, n - w.__last); w.__last = n; }, 20); });
  const resetGap = () => page.evaluate(() => { const w = window; const g = w.__gap; w.__gap = 0; return Math.round(g); });
  await resetGap();
  // run, tapping Space every 0.7 s, until the fall panel shows
  await page.keyboard.down('ArrowRight');
  const t1 = Date.now();
  let shown = false, i = 0;
  while (Date.now() - t1 < maxWaitS * 1000) {
    if (i++ % 2 === 0) await page.keyboard.press('Space');
    await page.waitForTimeout(350);
    shown = await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => /again \(R\)/.test(b.textContent ?? '') && b.offsetParent !== null));
    if (shown) break;
  }
  await page.keyboard.up('ArrowRight');
  out.panelShown = shown;
  out.secondsToPanel = Math.round((Date.now() - t1) / 100) / 10;
  out.longestBlockBeforePanelMs = await resetGap();
  out.gapsAt = await page.evaluate(() => window.__gaps); // [seconds since the check began, how long the page was blocked in ms]
  if (shown) {
    const t2 = Date.now();
    await page.keyboard.press('KeyR');
    await page.waitForTimeout(1500);
    out.restartLongestBlockMs = await resetGap();
    out.restartWallMs = Date.now() - t2;
  }
  // pass: the page was never blocked for long when the fall panel came up or on restart (a software-GPU frame is a few hundred ms, a search is tens of seconds)
  out.pass = shown ? out.longestBlockBeforePanelMs < 400 && out.restartLongestBlockMs < 400 : null; // null: it never fell in the time given, so not tested
  if (out.pass === false) process.exitCode = 1;
  console.log(JSON.stringify(out));
  await browser.close();
} finally { server.kill(); }
