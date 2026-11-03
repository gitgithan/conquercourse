// CC-133 step 1: a course with no stored plan, ghost on and drums on, is searched once and shows one panel (desktop 1280 px only).
// Usage: PORT=5894 node scripts/search-cache-check.mjs [outdir]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'test-results/search-cache'; mkdirSync(out, { recursive: true });
const port = Number(process.env.PORT ?? 5894);
const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 6000));
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const results = []; const ok = (n, p, note = '') => { results.push(p); console.log(p ? 'PASS' : 'FAIL', n, note); };
try {
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await page.addInitScript(() => {
    try { localStorage.setItem('cc.next.seen', '1'); localStorage.removeItem('cc.ghost.mode'); } catch { /* shots */ }
    window.__panelsSeen = 0; // how many times a progress panel was added to the page
    new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.id === 'search-progress') window.__panelsSeen++; }).observe(document, { childList: true, subtree: true });
  });
  await page.goto(`http://localhost:${port}/?course=/assets/demo/bars.course.json&welcome=0&tour=0&drums=1`);
  await page.waitForSelector('#keys', { state: 'attached', timeout: 120000 });
  await page.waitForSelector('#search-progress', { timeout: 60000 });
  await page.waitForFunction(() => /\(\d+ of \d+\)/.test(document.getElementById('search-line')?.textContent ?? ''), null, { timeout: 60000 });
  await page.waitForTimeout(3000); // let the ghost's ask and the take-off windows' ask arrive too
  const mid = await page.evaluate(() => ({ panels: document.querySelectorAll('#search-progress').length, seen: window.__panelsSeen, stats: window.__searchStats, line: document.getElementById('search-line')?.textContent }));
  console.log(JSON.stringify(mid));
  ok('exactly one panel on the page', mid.panels === 1);
  await page.screenshot({ path: `${out}/search-cache-1280.png` });
  await page.waitForSelector('#search-progress', { state: 'detached', timeout: 600000 });
  await page.waitForTimeout(3000);
  const end = await page.evaluate(() => ({ seen: window.__panelsSeen, stats: window.__searchStats }));
  console.log(JSON.stringify(end));
  ok('one search started for the whole visit', end.stats.started === 1, JSON.stringify(end.stats));
  ok('one panel opened for the whole visit', end.seen === 1 && end.stats.panels === 1, `seen ${end.seen}`);
  ok('the other askers joined it', end.stats.joined >= 1, JSON.stringify(end.stats));
  await page.screenshot({ path: `${out}/search-cache-done-1280.png` });
  await page.close();
} finally { await b.close(); vite.kill(); }
process.exit(results.every(Boolean) ? 0 : 1);
