// Lab 18 (World Slicer: map to lane) in the browser at 1280 px: off without the labs switch; with it the map, lane and simulator verdict are filled on open; a challenge starts, is checked, and reveals.
// Screenshots go to test-results/lab-slicer/.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5184';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const result = {};
let failed = false;
const check = (name, ok, extra = '') => { result[name] = ok ? 'ok' : `FAILED ${extra}`; if (!ok) failed = true; };
const verdictReady = () => /Simulator: /.test(document.getElementById('sl-verdict')?.textContent ?? '');
try {
  await new Promise((r) => setTimeout(r, 4000));
  const browser = await chromium.launch({ args: process.env.WEBGL2 ? ['--use-gl=angle', '--use-angle=swiftshader'] : [] });
  mkdirSync('test-results/lab-slicer', { recursive: true });
  const base = `http://localhost:${port}`;
  const errors = [];
  const off = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  off.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await off.goto(`${base}/?mode=lab-slicer&labs=0&backend=webgl2`);
  await off.waitForSelector('#lab-slicer', { timeout: 60000 });
  check('off message', (await off.textContent('#lab-slicer')).includes('Labs are switched off'));
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await page.goto(`${base}/?mode=lab-slicer&labs=1&backend=webgl2`);
  await page.waitForFunction(() => document.documentElement.dataset.labPopulated === 'lab-slicer', null, { timeout: 120000 });
  await page.waitForFunction(verdictReady, null, { timeout: 60000 });
  const v = await page.textContent('#sl-verdict');
  check('simulator clears on open', v.includes('Simulator: clears'), v);
  const all = await page.textContent('#lab-slicer');
  check('no undefined or NaN', !/undefined|NaN/.test(all), all.slice(0, 300));
  check('OSM credit', all.includes('OpenStreetMap'));
  check('nav bar names the Lab', (await page.textContent('#labs-nav')).includes('World Slicer'));
  check('rules table filled', (await page.$$('#sl-rules tr')).length >= 3);
  await page.screenshot({ path: 'test-results/lab-slicer/open.png', fullPage: true });
  await page.click('#sl-chals button[data-start="cut-high"]');
  await page.waitForFunction(verdictReady, null, { timeout: 60000 });
  await page.click('#sl-chals button[data-check="cut-high"]');
  const res = await page.textContent('#sl-res-cut-high');
  check('challenge check answers', res.trim().length > 0, res);
  await page.click('#sl-chals button[data-reveal="cut-high"]');
  check('reveal shown', await page.isVisible('#sl-rev-cut-high'));
  await page.screenshot({ path: 'test-results/lab-slicer/challenge.png', fullPage: true });
  check('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
} catch (e) { check('run', false, String(e)); } finally { server.kill(); }
console.log(JSON.stringify(result, null, 2));
process.exit(failed ? 1 : 0);
