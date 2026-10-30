// CC-240: timed balls on the default map. Stand still: the first ball of the start launcher reaches the runner and the try ends (outcome hurt).
// A picture shows a ball in flight. Usage: node scripts/shots-check.mjs [outdir]   (desktop 1280 only; run on the VM)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'test-results/shots'; mkdirSync(out, { recursive: true });
const port = process.env.PORT ?? '5894';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'];
let bad = 0; const check = (n, ok) => { console.log(ok ? 'ok  ' : 'FAIL', n); if (!ok) bad++; };
try {
  await new Promise((r) => setTimeout(r, 6000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`http://localhost:${port}/?welcome=0&tour=0`);
  await page.waitForSelector('html[data-ready=true]', { timeout: 180000 });
  await page.waitForFunction(() => Number(document.documentElement.dataset.tick) > 385, null, { timeout: 200000 }); // 3.2 s: the ball is in flight
  await page.screenshot({ path: `${out}/ball-in-flight.png` });
  await page.waitForFunction(() => document.documentElement.dataset.outcome === 'hurt', null, { timeout: 200000 });
  check('standing still at the start: the first ball ends the try', true);
  await page.screenshot({ path: `${out}/ball-hit.png` });
  await browser.close();
} catch (e) { console.log('FAIL', String(e).slice(0, 300)); bad++; } finally { server.kill(); }
console.log(bad ? 'FAILED' : 'PASS'); process.exit(bad ? 1 : 0);
