// Lab 21 (what the model cannot do) in the browser at 1280 px: off without the labs switch; with it every output is filled on open;
// a card moves to another bin, the gate slider changes precision and recall, the design challenge reaches the cheapest safe design.
// Screenshots go to test-results/lab-limits/.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5185';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const result = {};
let failed = false;
const check = (name, ok, extra = '') => { result[name] = ok ? 'ok' : `FAILED ${extra}`; if (!ok) failed = true; };
try {
  await new Promise((r) => setTimeout(r, 4000));
  const browser = await chromium.launch({ args: process.env.WEBGL2 ? ['--use-gl=angle', '--use-angle=swiftshader'] : [] });
  mkdirSync('test-results/lab-limits', { recursive: true });
  const base = `http://localhost:${port}`;
  const errors = [];
  const off = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  off.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await off.goto(`${base}/?mode=lab-limits&labs=0&backend=webgl2`);
  await off.waitForSelector('#lab-limits', { timeout: 60000 });
  check('off message', (await off.textContent('#lab-limits')).includes('Labs are switched off'));
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await page.goto(`${base}/?mode=lab-limits&labs=1&backend=webgl2`);
  await page.waitForFunction(() => document.documentElement.dataset.labPopulated === 'lab-limits', null, { timeout: 90000 });
  const txt = await page.textContent('#lab-limits');
  check('no undefined or NaN', !/undefined|NaN/.test(txt));
  check('nav bar names the Lab', (await page.textContent('#labs-nav')).includes("What the model cannot do"));
  check('11 cards', (await page.$$('#lim-bins .fc')).length === 11);
  check('every picture loaded', await page.$$eval('#lim-bins img', (is) => is.every((i) => i.complete && i.naturalWidth > 0)));
  check('gate opens at the game limit', (await page.textContent('#lim-p')) === '100%' && (await page.textContent('#lim-r')) === '50%', await page.textContent('#lim-r'));
  await page.screenshot({ path: 'test-results/lab-limits/open.png', fullPage: true });
  // move one card by its button, then start over
  await page.click('#lim-card-pixel button[data-mv="cant"]');
  check('card moved', (await page.$$('#lim-bin-cant #lim-card-pixel')).length === 1);
  check('says a different bin', (await page.textContent('#lim-says')).includes('different bin'));
  await page.click('#lim-reset');
  check('reset empties the bins', (await page.$$('#lim-tray .fc')).length === 11);
  // gate slider: a tight limit flags more, recall rises
  await page.$eval('#lim-lim', (e) => { e.value = '1.2'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  const r2 = parseInt(await page.textContent('#lim-r'), 10);
  check('tight limit raises recall', r2 > 50, String(r2));
  await page.$eval('#lim-cut', (e) => { e.value = '0.6'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  check('finder cut text', (await page.textContent('#lim-find-says')).includes('Bar patterns found: 0 of 2'));
  await page.click('#lim-eq-btn');
  check('maths shown', (await page.textContent('#lim-eq')).includes('precision'));
  // design: starts naive, then the cheapest safe design
  check('naive design is flagged', (await page.textContent('#lim-total')).includes('Not every stage'));
  for (const [s, o] of [['find', 'click'], ['lift', 'fit'], ['move', 'gate']]) await page.check(`input[name="lim-${s}"][value="${o}"]`);
  const tot = await page.textContent('#lim-total');
  check('cheapest safe design', tot.includes('All three stages') && tot.includes('calls for your design: 3'), tot);
  await page.screenshot({ path: 'test-results/lab-limits/done.png', fullPage: true });
  check('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
} catch (e) { check('run', false, String(e)); } finally { server.kill(); }
console.log(JSON.stringify(result, null, 2));
process.exit(failed ? 1 : 0);
