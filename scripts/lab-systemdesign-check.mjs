// The system design Lab in the browser at 1280 px: off without the labs switch; blocks drop into nine cards; Run moves the meters; a misfit opens a three-step hint ladder; a second good design is offered; the partner falls back to a recorded example when the server has no key.
// Screenshots go to test-results/lab-systemdesign/. A live partner call is never made here (the route is stubbed).
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
  mkdirSync('test-results/lab-systemdesign', { recursive: true });
  const base = `http://localhost:${port}`;
  const errors = [];
  const off = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  off.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await off.goto(`${base}/?mode=lab-systemdesign&labs=0&backend=webgl2`);
  await off.waitForSelector('#lab-systemdesign', { timeout: 60000 });
  check('off message', (await off.textContent('#lab-systemdesign')).includes('Labs are switched off'));
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await page.route('**/api/design-partner', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"off"}' }));
  await page.goto(`${base}/?mode=lab-systemdesign&labs=1&backend=webgl2`);
  await page.waitForFunction(() => document.documentElement.dataset.labPopulated === 'lab-systemdesign', null, { timeout: 90000 });
  check('nav names the Lab', (await page.textContent('#labs-nav')).includes('System design'));
  check('flow chips', (await page.textContent('#lab-flow-top')).includes('uses:') && (await page.textContent('#lab-flow-top')).includes('from:'));
  check('nine cards, three blocks each', (await page.locator('.slot').count()) === 9 && (await page.locator('.slot').first().locator('.blk').count()) === 3);
  check('meters wait for Run', (await page.locator('#sd-meters .tile.idle').count()) === 8);
  await page.screenshot({ path: 'test-results/lab-systemdesign/starter.png', fullPage: true });
  await page.click('#sd-run');
  await page.waitForFunction(() => document.querySelector('#lab-systemdesign').dataset.ran === '1', null, { timeout: 8000 });
  check('starter has a red meter and a misfit card', (await page.locator('#sd-meters .tile.bad').count()) >= 3 && (await page.locator('.slot.misfit').count()) >= 3);
  // hints open one at a time; hint 2 carries a link chip to an earlier Lab
  const card = page.locator('.slot.misfit').first();
  await card.locator('button[data-more]').click();
  check('hint 1 names a meter', /meter/.test(await card.locator('.hint').textContent()));
  await card.locator('button[data-more]').click();
  check('hint 2 has a Lab chip', (await card.locator('.hint a.chip').count()) === 1);
  await card.locator('button[data-more]').click();
  check('hint 3 says why a better block fits', (await card.locator('.hint li').count()) === 3);
  await page.screenshot({ path: 'test-results/lab-systemdesign/misfit.png', fullPage: true });
  // fix each red card by press (three by real drag and drop), then run
  await page.dragAndDrop('.blk[data-slot="photo"][data-id="link"]', '.slot[data-slot="photo"]', { targetPosition: { x: 20, y: 20 } });
  await page.dragAndDrop('.blk[data-slot="wait"][data-id="warmup"]', '.slot[data-slot="wait"]', { targetPosition: { x: 20, y: 20 } });
  await page.click('.blk[data-slot="collider"][data-id="box"]');
  check('drag and drop puts the block in', (await page.locator('.blk[data-slot="photo"][data-id="link"]').getAttribute('aria-pressed')) === 'true' && (await page.locator('.blk[data-slot="wait"][data-id="warmup"]').getAttribute('aria-pressed')) === 'true');
  check('a change dims the old meters', (await page.textContent('#sd-status')).includes('Press Run'));
  await page.click('#sd-run');
  await page.waitForFunction(() => /Cleared/.test(document.querySelector('#sd-status').textContent), null, { timeout: 8000 });
  check('a passing design clears and offers a different good design', (await page.textContent('#sd-status')).includes('A different good design'));
  await page.screenshot({ path: 'test-results/lab-systemdesign/cleared.png', fullPage: true });
  // the second brief changes what counts
  await page.click('button[data-brief="kiosk"]');
  await page.click('#sd-run');
  await page.waitForFunction(() => document.querySelector('#sd-meters .tile[data-meter="offline"]')?.dataset.level, null, { timeout: 8000 });
  check('kiosk brief turns offline red for runtime models', (await page.locator('#sd-meters .tile[data-meter="offline"]').getAttribute('data-level')) === 'bad');
  await page.click('button[data-brief="online"]');
  await page.click('#sd-reset');
  check('reset returns the starter', (await page.locator('.blk[data-slot="wait"][data-id="block"]').getAttribute('aria-pressed')) === 'true');
  await page.click('#sd-ask');
  await page.waitForSelector('#sd-partner-text', { timeout: 10000 });
  check('partner falls back to a recorded comment, labelled', (await page.textContent('#sd-partner')).includes('recorded comment'), await page.textContent('#sd-partner'));
  check('Back to the game opens the Courses screen', await (async () => { await page.click('#lab-flow-next'); await page.waitForTimeout(800); return (await page.locator('text=Labs, Finale').count()) > 0 || (await page.locator('[role=dialog], #world-gallery, .gallery').count()) > 0; })());
  check('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
} catch (e) { check('run', false, String(e)); } finally { server.kill(); }
console.log(JSON.stringify(result, null, 2));
process.exit(failed ? 1 : 0);
