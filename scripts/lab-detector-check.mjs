// Lab 10 (Evaluating a detector) in the browser at 1280 px: off without the labs switch; with it, the recorded numbers show (2 found, 11 made up), sliding the line changes them, the maths come on request, our choice is shown.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5181';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const result = {};
let failed = false;
const check = (name, ok, extra = '') => { result[name] = ok ? 'ok' : `FAILED ${extra}`; if (!ok) failed = true; };
try {
  await new Promise((r) => setTimeout(r, 4000));
  const browser = await chromium.launch();
  mkdirSync('test-results/lab-detector', { recursive: true });
  const base = `http://localhost:${port}`;
  const errors = [];
  const off = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  off.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await off.goto(`${base}/?mode=lab-detector&labs=0`);
  await off.waitForSelector('#lab-detector', { timeout: 60000 });
  check('off message', (await off.textContent('#lab-detector')).includes('Labs are switched off'));

  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await page.goto(`${base}/?mode=lab-detector&labs=1`);
  await page.waitForFunction(() => document.documentElement.dataset.labReady === 'true', null, { timeout: 60000 });
  check('recorded: 2 found', (await page.textContent('#ld-found')) === '2');
  check('recorded: 11 made up', (await page.textContent('#ld-made')) === '11');
  check('equations hidden at start', await page.$eval('#ld-eq-body', (e) => e.hidden));
  await page.screenshot({ path: 'test-results/lab-detector/start.png', fullPage: true });
  await page.fill('#ld-claim', '0.5');
  const made = await page.textContent('#ld-made');
  check('higher claim line cuts made-up', Number(made) < 11, made);
  await page.click('button[data-prompt=bar]'); await page.click('button[data-prompt=ledge]'); await page.click('button[data-prompt=step]');
  check('rail only keeps rail rows', (await page.$$eval('#ld-hard tr', (r) => r.length)) === 7);
  await page.click('#ld-keep');
  await page.waitForFunction(() => document.documentElement.dataset.labDone === '1');
  await page.click('#ld-eq-btn');
  check('maths shown', (await page.textContent('#ld-eq-body')).includes('2 P R'));
  check('our choice shown last', (await page.textContent('#ld-ours-p')).includes('does not use this detector'));
  await page.screenshot({ path: 'test-results/lab-detector/after.png', fullPage: true });
  check('no page errors', errors.length === 0, errors.join('|'));
  await browser.close();
} catch (e) { check('script', false, String(e)); }
server.kill();
console.log(JSON.stringify(result, null, 2));
process.exit(failed ? 1 : 0);
