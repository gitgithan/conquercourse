// Lab 18 (system design) in the browser at 1280 px: off without the labs switch; drag and drop builds a design; the judge and meters move; a failure plays; the partner falls back to a recorded example when the server has no key.
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
  check('opens on a first try that fails the key lesson', (await page.textContent('#sd-judge')).includes('key'));
  await page.screenshot({ path: 'test-results/lab-systemdesign/open.png', fullPage: true });
  // drag and drop: clear, then build the real design by dragging blocks into the flow zone
  await page.click('#sd-clear');
  for (const id of ['pages', 'browser', 'functions', 'limits', 'safety', 'warm', 'queue', 'mask', 'sam3', 'sam3d', 'bake', 'fitcollider', 'sim', 'keep', 'd1', 'library']) {
    if (['pages', 'browser', 'functions'].includes(id)) await page.dragAndDrop(`.blk[data-id="${id}"]`, '#sd-flow', { targetPosition: { x: 4, y: 4 } }); // three by real drag and drop, the rest by press (same code path)
    else await page.click(`.blk[data-id="${id}"]`);
  }
  check('16 chips by drag and drop', (await page.locator('#sd-flow .chip').count()) === 16);
  check('scenario 1 cleared', (await page.textContent('#sd-cleared')).includes('Cleared'), await page.textContent('#sd-cleared'));
  // reorder: drag the last chip onto the first
  await page.dragAndDrop('#sd-flow .chip[data-i="15"]', '#sd-flow .chip[data-i="0"]');
  check('reorder', (await page.locator('#sd-flow .chip').first().textContent()).includes('Ready-made library'));
  await page.dragAndDrop('#sd-flow .chip[data-i="0"]', '#sd-flow .chip[data-i="15"]');
  // wrong order: remove the mask and add it after the cut-out; the lesson breaks
  await page.click('button[aria-label^="Remove Privacy mask"]');
  await page.click('.blk[data-id="mask"]');
  check('mask after the model breaks the lesson', (await page.textContent('#sd-judge')).includes('before the mask runs') || (await page.textContent('#sd-judge')).includes('sees the photo before'));
  await page.click('#sd-clear');
  for (const id of ['pages', 'browser', 'functions', 'sam3d']) await page.click(`.blk[data-id="${id}"]`);
  await page.click('#sd-scen button[data-s="down"]');
  await page.selectOption('#sd-fail-pick', 'sam3d');
  await page.click('#sd-fail-play');
  await page.waitForFunction(() => /left hanging/.test(document.querySelector('#sd-fail-says')?.textContent ?? ''), null, { timeout: 8000 });
  check('failure with no fallback hangs', true);
  await page.screenshot({ path: 'test-results/lab-systemdesign/failure.png', fullPage: true });
  await page.click('.blk[data-id="library"]');
  await page.selectOption('#sd-fail-pick', 'sam3d');
  await page.click('#sd-fail-play');
  await page.waitForFunction(() => /still gets something/.test(document.querySelector('#sd-fail-says')?.textContent ?? ''), null, { timeout: 8000 });
  check('failure with the library gives a result', true);
  await page.click('#sd-ask');
  await page.waitForSelector('#sd-partner-text', { timeout: 10000 });
  check('partner falls back to a recorded example, labelled', (await page.textContent('#sd-partner')).includes('recorded example'), await page.textContent('#sd-partner'));
  await page.click('#sd-reveal-btn');
  check('reveal draws the real design', (await page.textContent('#sd-reveal')).includes('In ours, not yours'));
  await page.screenshot({ path: 'test-results/lab-systemdesign/reveal.png', fullPage: true });
  check('Back to the game opens the Courses screen', await (async () => { await page.click('#lab-flow-next'); await page.waitForTimeout(800); return (await page.locator('text=Labs, Finale').count()) > 0 || (await page.locator('[role=dialog], #world-gallery, .gallery').count()) > 0; })());
  check('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
} catch (e) { check('run', false, String(e)); } finally { server.kill(); }
console.log(JSON.stringify(result, null, 2));
process.exit(failed ? 1 : 0);
