// CC-159: a visible "R Restart" chip during a run, a Restart button on phones, both start the run again; R and the chip at the same moment is fine.
// Usage: node scripts/restart-chip-check.mjs [outdir]   (one browser at a time; run it on the VM)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'test-results/restart'; mkdirSync(out, { recursive: true });
const port = Number(process.env.PORT ?? 5888);
const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 6000));
const results = []; const ok = (n, p, note = '') => { results.push(p); console.log(p ? 'PASS' : 'FAIL', n, note); };
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const secs = (page) => page.evaluate(() => Number(document.body.innerText.match(/Time ([\d.]+) s/)?.[1] ?? NaN));
async function open(query, w, h) {
  const page = await b.newPage({ viewport: { width: w, height: h } });
  const errs = []; page.on('pageerror', (e) => { if (!/popErrorScope/.test(String(e))) errs.push(String(e)); });
  await page.goto(`http://localhost:${port}/?course=/assets/demo/training.course.json&welcome=0&tour=0&ghost=1&${query}`);
  await page.waitForSelector('#keys', { state: 'attached', timeout: 120000 });
  await page.waitForTimeout(2500);
  return { page, errs };
}
async function runFor(page, ms) { await page.keyboard.down('ArrowRight'); await page.waitForTimeout(ms); await page.keyboard.up('ArrowRight'); return secs(page); }
// desktop
{
  const { page, errs } = await open('', 1280, 720);
  ok('the Restart chip is visible during the run', await page.locator('#restart-chip').isVisible(), (await page.locator('#restart-chip').innerText()).replace(/\n/g, ' '));
  let t = await runFor(page, 3000); ok('time runs', t > 1, `${t} s`);
  await page.screenshot({ path: `${out}/chip-1280.png` });
  await page.keyboard.press('KeyR'); await page.waitForTimeout(400);
  const afterR = await secs(page); ok('R starts again: the timer is back near zero', afterR < t && afterR < 1, `${t} -> ${afterR}`);
  t = await runFor(page, 3000);
  await page.click('#restart-chip'); await page.waitForTimeout(400);
  const afterChip = await secs(page); ok('the chip starts again: the timer is back near zero', afterChip < t && afterChip < 1, `${t} -> ${afterChip}`);
  t = await runFor(page, 2500);
  await Promise.all([page.keyboard.press('KeyR'), page.click('#restart-chip')]); await page.waitForTimeout(500);
  const both = await secs(page); ok('R and the chip at the same moment: one clean restart', both < 1.2, `${t} -> ${both}`);
  ok('the ghost chip still works after restarts', await page.locator('text=/Ghost/').first().isVisible());
  ok('no page errors (desktop)', errs.length === 0, errs.join(' | ').slice(0, 200));
  await page.close();
}
// phone: the touch button says Restart and works; ?touch=0 hides the pad
{
  const { page, errs } = await open('touch=1', 390, 760);
  const label = await page.locator('#touch-retry').innerText();
  ok('the phone has a Restart button', /Restart/.test(label), label);
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(3000); await page.keyboard.up('ArrowRight');
  const t = await secs(page);
  await page.screenshot({ path: `${out}/chip-390.png` });
  await page.locator('#touch-retry').dispatchEvent('pointerdown', { pointerId: 1, bubbles: true }); await page.locator('#touch-retry').dispatchEvent('pointerup', { pointerId: 1, bubbles: true });
  await page.waitForTimeout(500);
  const after = await secs(page); ok('the phone Restart button starts again', after < t && after < 1, `${t} -> ${after}`);
  ok('no page errors (phone)', errs.length === 0, errs.join(' | ').slice(0, 200));
  await page.close();
}
{
  const { page } = await open('touch=0', 390, 760);
  ok('?touch=0 hides the touch buttons', (await page.locator('#touch-pad').count()) === 0);
  ok('the chip is still there with ?touch=0', await page.locator('#restart-chip').isVisible());
  await page.close();
}
await b.close(); vite.kill(); process.exit(results.every(Boolean) ? 0 : 1);
