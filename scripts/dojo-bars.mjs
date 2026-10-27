// The Dojo lesson for a swing on a bar: the time of one swing follows the length, pushing grows the swing, the saying shows, the formula comes last.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/?mode=dojo&ex=bars`);
  await page.waitForSelector('html[data-ready=true]', { state: 'attached', timeout: 30000 }).catch(() => console.log('NOT READY', errors));
  mkdirSync('test-results/dojo', { recursive: true });
  const set = (id, v) => page.$eval(`#${id}`, (el, v) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  const has = async (t) => (await page.textContent('body')).includes(t);
  const checks = {};
  checks.whyShown = await has('hang like a pendulum');
  checks.noFormulaYet = !(await has('time of one swing = 2π'));
  await page.click('#next');
  checks.sayingShown = await has('Push with the swing and it grows');
  await set('knob-length', 1.4);
  const T = (L) => (2 * Math.PI * Math.sqrt(L / 9.81)).toFixed(1);
  checks.defaultPeriod = (await page.textContent('#out')).includes(`${T(1.4)} s`);
  await set('knob-length', 2.8);
  checks.longerIsSlower = (await page.textContent('#out')).includes(`${T(2.8)} s`);
  await set('knob-push', 1); await set('knob-seconds', 8);
  const withPush = await page.textContent('body');
  await set('knob-push', -1);
  const againstPush = await page.textContent('body');
  const deg = (t) => Number((/climbs to about (\d+)°/.exec(t) ?? [])[1] ?? NaN);
  checks.pushingWithGrows = deg(withPush) > deg(againstPush) + 20;
  await page.screenshot({ path: 'test-results/dojo/bars-try.png' });
  for (let i = 0; i < 4; i++) { const b = await page.$('#next'); if (!b) break; await b.click(); if (await has('time of one swing = 2π')) break; }
  checks.formulaLast = await has('time of one swing = 2π');
  console.log(checks, deg(withPush), deg(againstPush), 'errors:', errors);
  await browser.close();
} finally { server.kill(); }
