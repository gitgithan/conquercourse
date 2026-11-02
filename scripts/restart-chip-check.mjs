// CC-159: a visible "R Restart" chip during a run (only with ?hud=restart since CC-165; the phone parts were removed, desktop 1280 px only), both start the run again; R and the chip at the same moment is fine.
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
async function open(query, w, h, nav = 0) {
  const page = await b.newPage({ viewport: { width: w, height: h } });
  const errs = []; page.on('pageerror', (e) => { if (!/popErrorScope/.test(String(e))) errs.push(String(e)); });
  await page.goto(`http://localhost:${port}/?course=/assets/demo/training.course.json&welcome=0&tour=0&ghost=1&hud=restart&nav=${nav}&${query}`);
  await page.waitForSelector('#keys', { state: 'attached', timeout: 120000 });
  await page.waitForTimeout(2500);
  return { page, errs };
}
async function runFor(page, ms) { await page.keyboard.down('ArrowRight'); await page.waitForTimeout(ms); await page.keyboard.up('ArrowRight'); return secs(page); }
// desktop
{
  const { page, errs } = await open('', 1280, 720);
  // With the site menu on, it sits on top of the chip: a real overlap (reported, not hidden).
  {
    const { page: p2 } = await open('', 1280, 720, 1);
    const hit = await p2.evaluate(() => { const r = document.querySelector('#restart-chip')?.getBoundingClientRect(); if (!r) return 'no chip'; const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return e && (e.id === 'restart-chip' || e.closest('#restart-chip')) ? 'ok' : `covered by ${e?.closest('nav,[id]')?.id ?? e?.tagName}`; });
    ok('the site menu does not cover the Restart chip', hit === 'ok', hit); await p2.close();
  }
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
await b.close(); vite.kill(); process.exit(results.every(Boolean) ? 0 : 1);
