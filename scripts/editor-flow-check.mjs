// CC-243: the editor end to end: the short default, the ready-made course list, Suggest Fix / Suggest More, the 30-piece limit.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5399', out = process.argv[2] ?? 'test-results/editor-flow';
mkdirSync(out, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const checks = {}, errors = [];
try {
  await new Promise((r) => setTimeout(r, 6000));
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  let sent = '';
  await page.route('**/api/designer', (r) => { sent = r.request().postData() ?? ''; r.fulfill({ json: { reply: 'ok' } }); });
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 120)));
  page.on('dialog', (d) => d.accept());
  const open = async () => { await page.goto(`http://localhost:${port}/?mode=editor&welcome=0`, { timeout: 120000, waitUntil: 'domcontentloaded' }); await page.waitForSelector('#view3d', { timeout: 90000 }); await page.waitForFunction(() => Number(document.documentElement.dataset.pieces) >= 3, null, { timeout: 90000 }); };
  await open();
  const n = Number(await page.evaluate(() => document.documentElement.dataset.pieces));
  checks.shortDefault = n >= 5 && n <= 6; // five objects, plus the person who shows the size
  checks.hasList = (await page.$$('#presetpick option')).length === 3;
  await page.waitForFunction(() => document.documentElement.dataset.laneClear !== undefined, null, { timeout: 120000 });
  checks.passingClears = (await page.evaluate(() => document.documentElement.dataset.laneClear)) === '1';
  checks.moreLabel = (await page.textContent('#suggest')) === 'Suggest More';
  await page.screenshot({ path: `${out}/1-default.png` });
  await page.selectOption('#presetpick', 'failing');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('#view3d', { timeout: 90000 });
  await page.waitForFunction(() => Number(document.documentElement.dataset.pieces) >= 5, null, { timeout: 90000 });
  await page.waitForFunction(() => document.documentElement.dataset.laneClear === '0', null, { timeout: 120000 });
  checks.brokenFails = true;
  checks.fixLabel = (await page.textContent('#suggest')) === 'Suggest Fix';
  await page.screenshot({ path: `${out}/2-broken.png` });
  if (await page.isVisible('#edglossary')) await page.click('#glossaryhide');
  if (!(await page.isVisible('#helper'))) await page.click('#helperbtn');
  console.log(checks);
  await page.click('#suggest');
  await page.waitForTimeout(800);
  const said = sent ? JSON.parse(sent).messages.map((m) => m.content).join(' ') : '';
  checks.promptSent = /cannot clear/.test(said) && (said.match(/ at \d/g) ?? []).length <= 3;
  await page.screenshot({ path: `${out}/3-suggest-fix.png` });
  for (let i = 0; i < 32; i++) { await page.evaluate(() => document.querySelector('button[data-object]')?.click()); await page.waitForTimeout(250); }
  await page.waitForTimeout(1500);
  checks.limit30 = (await page.evaluate(() => document.documentElement.dataset.capped)) === '1' && Number(await page.evaluate(() => document.documentElement.dataset.pieces)) <= 31;
  console.log(checks, 'errors', errors);
  await browser.close();
} finally { server.kill(); }
