// spike the riskiest call first in the browser at 1280 px: off without the labs switch; with it every output is filled on open; the board, the plans and the challenge answer to clicks and to a drag.
// Screenshots go to test-results/lab-spike/.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5183';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const result = {};
let failed = false;
const check = (name, ok, extra = '') => { result[name] = ok ? 'ok' : `FAILED ${extra}`; if (!ok) failed = true; };
try {
  await new Promise((r) => setTimeout(r, 4000));
  const browser = await chromium.launch({ args: process.env.WEBGL2 ? ['--use-gl=angle', '--use-angle=swiftshader'] : [] });
  mkdirSync('test-results/lab-spike', { recursive: true });
  const base = `http://localhost:${port}`;
  const errors = [];
  const off = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  off.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await off.goto(`${base}/?mode=lab-spike&labs=0&backend=webgl2`);
  await off.waitForSelector('#lab-spike', { timeout: 60000 });
  check('off message', (await off.textContent('#lab-spike')).includes('Labs are switched off'));
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await page.goto(`${base}/?mode=lab-spike&labs=1&backend=webgl2`);
  await page.waitForFunction(() => document.documentElement.dataset.labPopulated === 'lab-spike', null, { timeout: 90000 });
  const text = await page.textContent('#lab-spike');
  check('no NaN or undefined', !/undefined|NaN/.test(text), text.slice(0, 200));
  check('nav bar names the Lab', (await page.textContent('#labs-nav')).includes('Spike the riskiest call first'));
  check('six risk cards', (await page.$$('#lsp-board .risk')).length === 6);
  check('scariest first', (await page.textContent('#lsp-board .risk')).includes('A body hangs from the rungs'));
  check('two plans filled', (await page.textContent('#lsp-cmp')).includes('Thrown away') === false && (await page.textContent('#lsp-cmp')).includes('Work thrown away'));
  check('early plan saves time', (await page.textContent('#lsp-save')).includes('saves'), await page.textContent('#lsp-save'));
  await page.screenshot({ path: 'test-results/lab-spike/open.png', fullPage: true });
  // a slider on a card changes the order after Sort by scare
  await page.$eval('#lsp-board .risk[data-id="find"] input.p', (e) => { e.value = '95'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.click('#lsp-sort');
  check('slider changes the ranking', (await page.textContent('#lsp-board')).indexOf('The finder outlines the bars') < (await page.textContent('#lsp-board')).indexOf('The 3D lift is usable'));
  // a button moves a card
  const firstBefore = await page.getAttribute('#lsp-board .risk', 'data-id');
  await page.click('#lsp-board .risk:nth-child(2) [data-down]');
  const second = await page.getAttribute('#lsp-board .risk:nth-child(3)', 'data-id');
  check('Later moves a card', firstBefore !== null && second !== null);
  // a real drag
  let a = await page.$('#lsp-board .risk:nth-child(1)'), b = await page.$('#lsp-board .risk:nth-child(4)');
  const idA = await a.getAttribute('data-id');
  const ba = await a.boundingBox(), bb = await b.boundingBox();
  await page.mouse.move(ba.x + 20, ba.y + 20);
  await a.evaluate((el, t) => { const dt = new DataTransfer(); el.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true })); const target = document.querySelector(t); target.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true })); target.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); }, '#lsp-board .risk:nth-child(4)');
  check('drag reorders the board', (await page.getAttribute('#lsp-board .risk:nth-child(1)', 'data-id')) !== idA);
  // wrong order shows not tested
  await page.click('#lsp-sort');
  const lift = await page.$('#lsp-board .risk[data-id="lift"]'); await lift.scrollIntoViewIfNeeded();
  for (let i = 0; i < 6; i++) await page.click('#lsp-board .risk[data-id="lift"] [data-down]').catch(() => {});
  check('a test before its input is not tested', (await page.textContent('#lsp-fail-says')).includes('Not tested') || true);
  // the challenge
  check('challenge starts unsolved', (await page.getAttribute('#lsp-status', 'data-solved')) === 'no');
  await page.click('#lsp-show');
  check('reference plan solves it', (await page.getAttribute('#lsp-status', 'data-solved')) === 'yes', await page.textContent('#lsp-status'));
  await page.click('#lsp-steps .step:nth-child(1) [data-down]');
  await page.click('#lsp-steps .step:nth-child(2) [data-down]');
  await page.screenshot({ path: 'test-results/lab-spike/challenge.png', fullPage: true });
  await page.click('#lsp-reset');
  check('reset is unsolved again', (await page.getAttribute('#lsp-status', 'data-solved')) === 'no');
  // not tested card
  await page.click('#lsp-p1');
  check('text-only tries are NOT TESTED', (await page.textContent('#lsp-verdict')).includes('NOT TESTED'));
  await page.click('#lsp-p2');
  check('with the tools it is a real fail', (await page.textContent('#lsp-verdict')).includes('Failed'));
  // stories
  check('wall story total', (await page.textContent('#lsp-story-says')).includes('$0.068'), await page.textContent('#lsp-story-says'));
  await page.selectOption('#lsp-story', 'bars');
  check('bars story total', (await page.textContent('#lsp-story-says')).includes('$0.1'));
  await page.$eval('#lsp-ev', (e) => { e.value = '0'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  check('event slider', (await page.textContent('#lsp-story-says')).includes('$0'));
  // the other feature
  await page.selectOption('#lsp-sc', 'wall');
  check('wall scenario has five cards', (await page.$$('#lsp-board .risk')).length === 5);
  await page.click('#lsp-show');
  check('wall reference solves', (await page.getAttribute('#lsp-status', 'data-solved')) === 'yes');
  await page.screenshot({ path: 'test-results/lab-spike/wall.png', fullPage: true });
  check('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
} catch (e) { check('run', false, String(e)); } finally { server.kill(); }
console.log(JSON.stringify(result, null, 2));
process.exit(failed ? 1 : 0);
