// Lab 1 (Search) in the browser: off without the labs switch; with it, greedy is stranded and A* clears; the equations come after a run; the Courses list shows the Lab only with labs on.
// Screenshots go to test-results/lab-search/.
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
  mkdirSync('test-results/lab-search', { recursive: true });
  const base = `http://localhost:${port}`;
  const errors = [];

  // 1) labs off: a plain message, and the Courses list has no Labs group
  const off = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  off.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await off.goto(`${base}/?mode=lab-search&labs=0`);
  await off.waitForSelector('#lab-search', { timeout: 60000 });
  check('off message', (await off.textContent('#lab-search')).includes('Labs are switched off'));
  await off.screenshot({ path: 'test-results/lab-search/off.png' });
  await off.goto(`${base}/?mode=editor&labs=0`);
  await off.waitForSelector('.wg-btn, #worldbtn, [data-world-button]', { timeout: 20000 }).catch(() => {});

  // 2) labs on
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await page.goto(`${base}/?mode=lab-search&labs=1`);
  await page.waitForFunction(() => document.documentElement.dataset.labReady === 'true', null, { timeout: 60000 });
  await page.screenshot({ path: 'test-results/lab-search/start.png' });
  const eqHiddenAtStart = await page.$eval('#ls-eq', (e) => e.hidden);
  check('equations hidden before a run', eqHiddenAtStart === true);

  await page.click('#ls-run'); // greedy by distance
  await page.waitForFunction(() => document.documentElement.dataset.labDone === '1', null, { timeout: 120000 });
  const greedy = await page.textContent('#ls-facts');
  check('greedy is stuck', greedy.includes('Stuck'), greedy);
  await page.screenshot({ path: 'test-results/lab-search/greedy.png', fullPage: true });

  await page.click('button[data-method=astar]');
  await page.click('#ls-run');
  await page.waitForFunction(() => document.documentElement.dataset.labDone === '2', null, { timeout: 120000 });
  const astar = await page.textContent('#ls-facts');
  check('A* clears', astar.includes('Cleared the course'), astar);
  check('our line is shown last', (await page.$eval('#ls-ours', (e) => !e.hidden)) === true);
  await page.click('#ls-play');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/lab-search/playing.png', fullPage: true });
  await page.waitForTimeout(2500);
  await page.click('#ls-eq-btn');
  const eq = await page.textContent('#ls-eq-body');
  check('equations after a run', eq.includes('f = g + h'));
  await page.screenshot({ path: 'test-results/lab-search/astar.png', fullPage: true });

  // 3) the Courses list shows the Lab with labs on
  await page.goto(`${base}/?mode=editor&labs=1`);
  await page.waitForTimeout(2500);
  const open = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^Courses/.test(x.textContent ?? '')); if (b) { b.click(); return true; } return false; });
  await page.waitForTimeout(800);
  check('Courses list has the Lab with labs on', open && (await page.$('.wg-card[data-value=lab-search]')) !== null);
  await page.screenshot({ path: 'test-results/lab-search/courses-labs-on.png' });

  const offList = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await offList.goto(`${base}/?mode=editor&labs=0`);
  await offList.waitForTimeout(2500);
  const open2 = await offList.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^Courses/.test(x.textContent ?? '')); if (b) { b.click(); return true; } return false; });
  await offList.waitForTimeout(800);
  check('Courses list has no Lab with labs off', open2 && (await offList.$('.wg-card[data-value=lab-search]')) === null && !(await offList.textContent('body')).includes('Labs (university level)'));

  check('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
} finally {
  server.kill();
}
console.log(JSON.stringify(result, null, 2));
process.exit(failed ? 1 : 0);
