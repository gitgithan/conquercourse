// Lab 12 (Reinforcement learning) in the browser: off without the labs switch; with it, the default points teach a clear run;
// the "pays for staying alive" points are farmed and the run does not finish; the maths come after a run. Screenshots go to test-results/lab-rl/.
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
  mkdirSync('test-results/lab-rl', { recursive: true });
  const base = `http://localhost:${port}`;
  const errors = [];

  const off = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  off.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await off.goto(`${base}/?mode=lab-rl&labs=0`);
  await off.waitForSelector('#lab-rl', { timeout: 60000 });
  check('off message', (await off.textContent('#lab-rl')).includes('Labs are switched off'));

  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await page.goto(`${base}/?mode=lab-rl&labs=1`);
  await page.waitForFunction(() => document.documentElement.dataset.labReady === 'true', null, { timeout: 60000 });
  check('maths hidden before a run', (await page.$eval('#rl-eq', (e) => e.hidden)) === true);
  await page.screenshot({ path: 'test-results/lab-rl/start.png' });

  const t0 = Date.now();
  await page.click('#rl-run');
  await page.waitForFunction(() => document.documentElement.dataset.labDone === '1', null, { timeout: 120000 });
  const secs = (Date.now() - t0) / 1000;
  const honest = await page.textContent('#rl-facts');
  check('honest points clear', honest.includes('Clears the course'), honest);
  check('runs in a few seconds', secs < 15, String(secs));
  check('no hack note on honest points', (await page.$eval('#rl-hack', (e) => e.hidden)) === true);
  check('our line is shown last', (await page.$eval('#rl-ours', (e) => !e.hidden)) === true);
  await page.click('#rl-play');
  await page.waitForTimeout(600);
  await page.waitForTimeout(3000);
  const top = () => page.evaluate(() => document.querySelector('#lab-rl').scrollTo(0, 0));
  const to = (sel) => page.evaluate((q) => document.querySelector(q).scrollIntoView(), sel);
  await top();
  await page.screenshot({ path: 'test-results/lab-rl/honest-top.png' });
  await to('#rl-out');
  await page.screenshot({ path: 'test-results/lab-rl/honest-facts.png' });

  await page.click('button[data-preset=alive]');
  await page.fill('#rl-seed', '1');
  await page.click('#rl-run');
  await page.waitForFunction(() => document.documentElement.dataset.labDone === '2', null, { timeout: 120000 });
  const alive = await page.textContent('#rl-facts');
  check('staying-alive points do not clear', alive.includes('Does not clear'), alive);
  check('the hack is stated as a fact', (await page.$eval('#rl-hack', (e) => !e.hidden)) === true);
  await page.click('#rl-eq-btn');
  check('maths after a run', (await page.textContent('#rl-eq-body')).includes('Q(s, a)'));
  await top();
  await page.screenshot({ path: 'test-results/lab-rl/alive-top.png' });
  await to('#rl-hack');
  await page.screenshot({ path: 'test-results/lab-rl/alive-hack.png' });

  check('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
} finally {
  server.kill();
}
console.log(JSON.stringify(result, null, 2));
process.exit(failed ? 1 : 0);
