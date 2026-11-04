// Lab 17 (design partner loop) in the browser at 1280 px: off without the labs switch; with it the opening state is filled; stages scrub, a recorded answer of each kind loads, an edit is re-checked by the real simulator, Fix it clears, and a challenge says pass.
// Screenshots go to test-results/lab-partner/.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5184';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const result = {};
let failed = false;
const check = (name, ok, extra = '') => { result[name] = ok ? 'ok' : `FAILED ${extra}`; if (!ok) failed = true; };
try {
  await new Promise((r) => setTimeout(r, 4000));
  const browser = await chromium.launch({ args: process.env.WEBGL2 ? ['--use-gl=angle', '--use-angle=swiftshader'] : [] });
  mkdirSync('test-results/lab-partner', { recursive: true });
  const base = `http://localhost:${port}`;
  const errors = [];
  const off = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  off.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await off.goto(`${base}/?mode=lab-partner&labs=0&backend=webgl2`);
  await off.waitForSelector('#lab-partner', { timeout: 60000 });
  check('off message', (await off.textContent('#lab-partner')).includes('Labs are switched off'));
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await page.goto(`${base}/?mode=lab-partner&labs=1&backend=webgl2`);
  await page.waitForFunction(() => document.documentElement.dataset.labPopulated === 'lab-partner', null, { timeout: 90000 });
  const words = async () => (await page.textContent('#lp-words')).trim();
  check('nav names the Lab', (await page.textContent('#labs-nav')).includes('Design partner loop'));
  check('opening: not cleared, names the item', /Not cleared/.test(await words()) && (await words()).includes('stopped at item'), await words());
  check('no undefined or NaN', !/undefined|NaN/.test(await page.textContent('#lab-partner')));
  await page.screenshot({ path: 'test-results/lab-partner/open.png', fullPage: true });
  // Fix it
  await page.click('#lp-fix');
  await page.waitForFunction(() => /Cleared/.test(document.querySelector('#lp-words')?.textContent ?? ''), null, { timeout: 60000 });
  check('fix it clears', /Cleared/.test(await words()), await words());
  check('fix it listed', (await page.textContent('#lp-fixes')).includes('lowered to'));
  await page.click('button[data-st="5"]');
  await page.screenshot({ path: 'test-results/lab-partner/fixed.png', fullPage: true });
  // each kind
  for (const [kind, expect_] of [['malformed', 'Thrown out before any test'], ['rule', 'Thrown out before any test'], ['good', 'Cleared'], ['unprovable', 'Not cleared']]) {
    await page.click(`#lp-kinds button[data-kind="${kind}"]`);
    await page.click('button[data-st="3"]');
    await page.waitForFunction((t) => (document.querySelector('#lp-words')?.textContent ?? '').includes(t), expect_, { timeout: 60000 });
    check(`kind ${kind}`, true);
  }
  // edit: make a good course hard
  await page.click('#lp-kinds button[data-kind="tooHard"]');
  await page.click('[data-c="one"]');
  check('challenge starts not passed', (await page.textContent('#lp-ch-status')).includes('Nothing changed'), await page.textContent('#lp-ch-status'));
  await page.$eval('#lp-size', (e) => { e.value = '0.72'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForFunction(() => /PASS/.test(document.querySelector('#lp-ch-status')?.textContent ?? ''), null, { timeout: 60000 });
  check('challenge one passes through the simulator', true);
  await page.screenshot({ path: 'test-results/lab-partner/challenge.png', fullPage: true });
  await page.click('[data-c="why"]');
  for (const [id, g] of [['x1', 'reader'], ['r1', 'rules'], ['m006', 'simulator']]) await page.click(`[data-why="${id}"] button[data-g="${g}"]`);
  check('why challenge passes', (await page.textContent('#lp-ch-status')).includes('PASS'), await page.textContent('#lp-ch-status'));
  check('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
} catch (e) { check('run', false, String(e)); } finally { server.kill(); }
console.log(JSON.stringify(result, null, 2));
process.exit(failed ? 1 : 0);
