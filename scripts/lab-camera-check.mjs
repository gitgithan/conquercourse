// Lab 5 (camera and perspective) in the browser at 1280 px: off without the labs switch; with it the front pictures match, the second camera tells the bodies apart, the maths come on request.
// Screenshots go to test-results/lab-camera/.
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
  mkdirSync('test-results/lab-camera', { recursive: true });
  const base = `http://localhost:${port}`;
  const errors = [];
  const off = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  off.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await off.goto(`${base}/?mode=lab-camera&labs=0`);
  await off.waitForSelector('#lab-camera', { timeout: 60000 });
  check('off message', (await off.textContent('#lab-camera')).includes('Labs are switched off'));

  const page = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await page.goto(`${base}/?mode=lab-camera&labs=1`);
  await page.waitForFunction(() => document.documentElement.dataset.labReady === 'true', null, { timeout: 60000 });
  const twin0 = await page.textContent('#lc-twin');
  check('front gap is zero', /front photo[^]*?0\.000 px/.test(twin0), twin0);
  const gap = () => page.evaluate(() => Number(document.documentElement.dataset.labCamGap));
  const g90 = await gap();
  check('second camera at 90 degrees separates A and B', g90 > 40, String(g90));
  await page.click('#lc-front', { position: { x: 120, y: 90 } });
  await page.screenshot({ path: 'test-results/lab-camera/side.png' });
  await page.$eval('#lc-a', (e) => { e.value = '4'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  const g4 = await gap();
  check('second camera at 4 degrees cannot tell them apart', g4 < g90 / 4, `${g4} vs ${g90}`);
  await page.screenshot({ path: 'test-results/lab-camera/same-angle.png' });
  await page.$eval('#lc-a', (e) => { e.value = '90'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.click('#lc-keepbtn');
  await page.click('#lc-try');
  check('game side camera is nearly flat', (await page.textContent('#lc-cam')).includes('1.0'), await page.textContent('#lc-cam'));
  await page.click('#lc-eq-btn');
  check('maths shown', (await page.textContent('#lc-eq-body')).includes('tan(fov / 2)') || (await page.textContent('#lc-eq-body')).includes('tan('));
  await page.screenshot({ path: 'test-results/lab-camera/full.png', fullPage: true });
  check('no page errors', errors.length === 0, errors.join('; '));
  await browser.close();
} catch (e) { check('run', false, String(e).slice(0, 300)); }
finally { server.kill(); }
console.log(JSON.stringify(result, null, 2));
process.exit(failed ? 1 : 0);
