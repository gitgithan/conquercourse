// CC-243: how long the page is blocked. Editor: time to the lane verdict for each ready-made course, then the hand-off to the Course; also the Course after a visit to the Dojo.
// Long tasks (main thread blocked for 50 ms or more) are counted in the page. Run: PORT=5199 node scripts/lane-timing.mjs test-results/lane
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const port = process.env.PORT ?? '5199', out = process.argv[2] ?? 'test-results/lane'; mkdirSync(out, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const rows = [];
const probe = () => { window.__long = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push(Math.round(e.duration)); }).observe({ entryTypes: ['longtask'] }); } catch { /* no long tasks here */ } };
const longest = (page) => page.evaluate(() => Math.max(0, ...(window.__long ?? [0])));
try {
  await new Promise((r) => setTimeout(r, 5000));
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(probe);
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept());
  const base = `http://localhost:${port}/`;
  for (const id of ['swing', 'passing', 'coaster', 'failing']) {
    await page.goto(`${base}?mode=editor&welcome=0`);
    await page.waitForSelector('#presetpick', { timeout: 90000 });
    await Promise.all([page.waitForNavigation({ timeout: 60000 }).catch(() => {}), page.selectOption('#presetpick', id)]);
    await page.waitForTimeout(3000); await page.reload(); // the saved world is now this preset; measure a fresh page
    await page.waitForSelector('#presetpick', { timeout: 90000 });
    const t0 = Date.now();
    await page.waitForFunction(() => /simulator/i.test(document.documentElement.dataset.verdict ?? ''), null, { timeout: 300000 });
    const verdictMs = Date.now() - t0, verdict = await page.evaluate(() => document.documentElement.dataset.verdict);
    const row = { id, verdictMs, proof: await page.evaluate(() => document.documentElement.dataset.laneProof), verdict: verdict.slice(0, 60) };
    if (/can clear/.test(verdict)) {
      const t1 = Date.now();
      await page.click('#play');
      await page.waitForFunction(() => Number(document.documentElement.dataset.tick) > 0, null, { timeout: 200000 });
      row.courseReadyMs = Date.now() - t1;
      await page.waitForTimeout(4000);
      row.longestBlockMs = await longest(page);
      row.drums = await page.evaluate(() => !!document.querySelector('#drum-lane, .drum-lane'));
      await page.screenshot({ path: `${out}/${id}-course.png` });
    }
    rows.push(row); console.log(JSON.stringify(row));
  }
  // the Course after the Dojo: the same page, left for the Dojo and come back
  for (const course of ['', '?course=/assets/demo/training.course.json']) {
    await page.goto(`${base}${course}`); await page.waitForFunction(() => Number(document.documentElement.dataset.tick) > 0, null, { timeout: 200000 }); await page.waitForTimeout(2000);
    await page.goto(`${base}?mode=dojo&welcome=0`); await page.waitForTimeout(3000);
    const t2 = Date.now();
    await page.goBack(); await page.waitForFunction(() => Number(document.documentElement.dataset.tick) > 0, null, { timeout: 200000 });
    await page.waitForTimeout(4000);
    const row = { id: `dojo-back ${course || 'default'}`, courseReadyMs: Date.now() - t2 - 4000, longestBlockMs: await longest(page) };
    rows.push(row); console.log(JSON.stringify(row));
  }
  writeFileSync(`${out}/timing.json`, JSON.stringify(rows, null, 2) + '\n');
  await browser.close();
} finally { server.kill(); }
