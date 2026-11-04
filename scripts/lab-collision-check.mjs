// Lab 15 (collision from a 3D lift) in the browser at 1280 px: off without the labs switch; with it every output is filled on open, the steps scrub, break-it changes the comparison.
// Screenshots go to test-results/lab-collision/.
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
  mkdirSync('test-results/lab-collision', { recursive: true });
  const base = `http://localhost:${port}`;
  const errors = [];
  const off = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  off.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await off.goto(`${base}/?mode=lab-collision&labs=0&backend=webgl2`);
  await off.waitForSelector('#lab-collision', { timeout: 60000 });
  check('off message', (await off.textContent('#lab-collision')).includes('Labs are switched off'));
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await page.goto(`${base}/?mode=lab-collision&labs=1&backend=webgl2`);
  await page.waitForFunction(() => document.documentElement.dataset.labPopulated === 'lab-collision', null, { timeout: 90000 });
  const all = await page.textContent('#lcol-all');
  check('every step has an output', !/undefined|NaN/.test(all) && all.includes('n: 9') && all.includes('0.575'), all.slice(0, 400));
  check('nav bar names the Lab', (await page.textContent('#labs-nav')).includes('Collision from a 3D lift'));
  check('stage line', (await page.textContent('#lab-collision')).includes('Pipeline stage 4 of 8'));
  const sim = await page.textContent('#lcol-sim-says');
  check('simulator clears', sim.includes('cleared'), sim);
  await page.waitForFunction(() => !document.querySelector('#lskin-all')?.textContent.includes('working it out'), null, { timeout: 90000 });
  const skinAll = await page.textContent('#lskin-all');
  check('skin card: only the 5 cm box keeps the run', !/undefined|NaN/.test(skinAll) && (skinAll.match(/keeps the run/g) ?? []).length === 1, skinAll.slice(0, 400));
  await page.check('input[name=lskin-m][value=collider]');
  await page.waitForFunction(() => document.querySelector('#lskin-verdict')?.textContent.includes('The same run'), null, { timeout: 30000 });
  await page.check('input[name=lskin-p][value=box-snapped]'); await page.click('#lskin-check');
  check('challenge answers yes', (await page.textContent('#lskin-result')).includes('Yes'));
  await page.check('input[name=lskin-m][value=skin]');
  await page.waitForFunction(() => document.querySelector('#lskin-verdict')?.textContent.includes('different run'), null, { timeout: 30000 });
  await page.locator('#lskin').scrollIntoViewIfNeeded(); await page.locator('#lskin').screenshot({ path: 'test-results/lab-collision/skin-card.png' });
  await page.screenshot({ path: 'test-results/lab-collision/open.png', fullPage: true });
  for (const s of [1, 2, 3, 4, 5, 7, 8, 9]) { await page.click(`#lcol-steps button[data-step="${s}"]`); const t = await page.textContent('#lcol-title'); check(`step ${s}`, t.startsWith(`Step ${s} of 9`), t); }
  await page.selectOption('#lcol-brk', 'fused');
  await page.$eval('#lcol-idx', (e) => { e.value = '3'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  const v = await page.textContent('#lcol-verdict');
  check('fused changes the row', v.includes('changed'), v);
  await page.screenshot({ path: 'test-results/lab-collision/fused.png', fullPage: true });
  check('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
} catch (e) { check('run', false, String(e)); } finally { server.kill(); }
console.log(JSON.stringify(result, null, 2));
process.exit(failed ? 1 : 0);
