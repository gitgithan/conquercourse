// Signal processing in the browser: off without the labs switch; with it, a default run passes the gate and the Rookie plays;
// a live one-pole filter at full strength runs late; too much wobble is held back by the gate and nothing is played. Screenshots go to test-results/lab-signal/.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const result = {};
let failed = false;
const check = (name, ok, extra = '') => { result[name] = ok ? 'ok' : `FAILED ${extra}`; if (!ok) failed = true; };
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch();
  mkdirSync('test-results/lab-signal', { recursive: true });
  const base = `http://localhost:${port}`;
  const errors = [];
  const off = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await off.goto(`${base}/?mode=lab-signal&labs=0`);
  await off.waitForSelector('#lab-signal', { timeout: 60000 });
  check('off message', (await off.textContent('#lab-signal')).includes('Labs are switched off'));

  const page = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await page.goto(`${base}/?mode=lab-signal&labs=1`);
  await page.waitForFunction(() => document.documentElement.dataset.labReady === 'true', null, { timeout: 60000 });
  await page.waitForFunction(() => document.documentElement.dataset.signalRookie === '1', null, { timeout: 90000 }).catch(() => {});
  const facts = await page.textContent('#sg-facts');
  check('default run passes the gate', facts.includes('passes'), facts);
  const rookie = await page.evaluate(() => document.documentElement.dataset.signalRookie === '1');
  check('the Rookie is on screen', rookie);
  await page.waitForTimeout(1500);
  const f1 = await page.evaluate(() => document.documentElement.dataset.signalFrame);
  await page.waitForTimeout(1500);
  const f2 = await page.evaluate(() => document.documentElement.dataset.signalFrame);
  check('the clip is playing', rookie && f1 !== f2, `${f1} ${f2}`);
  check('the game setting is shown last', (await page.textContent('#sg-ours')).includes('1-2-3-2-1'));
  await page.screenshot({ path: 'test-results/lab-signal/default.png', fullPage: true });

  await page.click('button[data-kind=exponential]');
  await page.fill('#sg-s', '8');
  await page.dispatchEvent('#sg-s', 'input');
  await page.waitForTimeout(500);
  const late = await page.textContent('#sg-facts');
  const ms = Number(/Runs late by(-?\d+) ms/.exec(late)?.[1] ?? NaN);
  check('live smoothing at full strength runs late', ms > 150, late);
  await page.screenshot({ path: 'test-results/lab-signal/live-lag.png', fullPage: true });

  await page.selectOption('#sg-clip', 'run');
  await page.click('button[data-kind=triangle]');
  await page.fill('#sg-s', '2');
  await page.dispatchEvent('#sg-s', 'input');
  await page.fill('#sg-n', '4');
  await page.dispatchEvent('#sg-n', 'input');
  await page.check('#sg-fix');
  await page.waitForTimeout(800);
  const held = await page.evaluate(() => ({ shown: getComputedStyle(document.querySelector('#sg-held')).display, text: document.querySelector('#sg-held').textContent }));
  check('too much wobble is held back by the gate', held.shown === 'flex' && held.text.includes('Held back'), JSON.stringify(held));
  await page.screenshot({ path: 'test-results/lab-signal/held-back.png', fullPage: true });
  await page.click('#sg-eq-btn');
  check('equations after a run', (await page.textContent('#sg-eq-body')).includes('low-pass'));

  check('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
} finally {
  server.kill();
}
console.log(JSON.stringify(result, null, 2));
process.exit(failed ? 1 : 0);
