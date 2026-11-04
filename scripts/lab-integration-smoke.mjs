// Numerical integration browser smoke at 1280 px: opens ?mode=lab-integration&labs=1, runs the game's setting and then a coarse Euler, and saves pictures.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const port = process.env.PORT ?? '5191';
const out = process.env.OUT ?? 'test-results';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
let failed = '';
try {
  await new Promise((r) => setTimeout(r, 4000));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/?mode=lab-integration&labs=1&welcome=0`);
  await page.waitForSelector('html[data-lab-ready=true]', { timeout: 90000 });
  mkdirSync(out, { recursive: true });
  const pick = async (method, stepIdx, lenIdx) => {
    await page.click(`#li-methods button[data-method=${method}]`);
    await page.$eval('#li-step', (e, v) => { e.value = v; e.dispatchEvent(new Event('input')); }, String(stepIdx));
    await page.$eval('#li-len', (e, v) => { e.value = v; e.dispatchEvent(new Event('input')); }, String(lenIdx));
  };
  const run = async (n) => { await page.click('#li-run'); await page.waitForFunction((k) => document.documentElement.dataset.labDone === String(k), n, { timeout: 120000 }); };
  await pick('rk4', 4, 2); await run(1); // 120 a second, 300 s
  const equalGame = await page.evaluate(() => document.documentElement.dataset.labHashEqual);
  await pick('euler', 2, 2); await run(2); // 30 a second
  const equalEuler = await page.evaluate(() => document.documentElement.dataset.labHashEqual);
  await page.click('#li-eq-btn');
  await page.evaluate(() => { document.getElementById('lab-integration').scrollTop = 0; });
  await page.screenshot({ path: `${out}/lab-integration-euler.png`, fullPage: true });
  await pick('rk4', 4, 2); await run(3);
  await page.evaluate(() => { document.getElementById('lab-integration').scrollTop = 0; });
  await page.screenshot({ path: `${out}/lab-integration-rk4.png`, fullPage: true });
  const rows = await page.$$eval('#li-replays tr', (r) => r.map((x) => x.textContent));
  console.log(JSON.stringify({ equalGame, equalEuler, rows, errors }));
  if (equalGame !== 'true' || equalEuler !== 'false' || errors.length) failed = 'unexpected';
  await browser.close();
} finally { server.kill(); }
if (failed) { console.error('FAILED', failed); process.exit(1); }
