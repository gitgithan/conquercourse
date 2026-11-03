// CC-133: the progress panel of the live ideal-run search (desktop 1280 px only).
// Usage: PORT=5893 node scripts/search-progress-check.mjs [outdir]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'test-results/search-progress'; mkdirSync(out, { recursive: true });
const port = Number(process.env.PORT ?? 5893);
const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 6000));
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const results = []; const ok = (n, p, note = '') => { results.push(p); console.log(p ? 'PASS' : 'FAIL', n, note); };
async function open(course, q = '') {
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await page.addInitScript(() => { try { localStorage.setItem('cc.next.seen', '1'); localStorage.setItem('cc.ghost.mode', 'off'); } catch { /* shots */ } });
  await page.goto(`http://localhost:${port}/?course=/assets/demo/${course}.course.json&welcome=0&tour=0${q}`);
  await page.waitForSelector('#keys', { state: 'attached', timeout: 120000 });
  return page;
}
const read = (p) => p.evaluate(() => { const e = document.getElementById('search-progress'); return e ? { title: e.querySelector('strong').textContent, line: document.getElementById('search-line').textContent, eta: document.getElementById('search-eta').textContent, width: parseFloat(document.getElementById('search-fill')?.style.width ?? '0') } : null; });
try {
  // (the ghost is off here: with it on, a second search for the same course waits in line and opens its own panel after the first)
  // 1. a course with no stored plan: the drums search runs in the workers and shows the panel
  const p = await open('bars');
  await p.waitForSelector('#search-progress', { timeout: 60000 });
  await p.waitForFunction(() => /\(\d+ of \d+\)/.test(document.getElementById('search-line')?.textContent ?? ''), null, { timeout: 60000 });
  const a = await read(p);
  ok('panel has a plain title', a.title === 'Working out the best run for your course', a.title);
  ok('panel names the obstacle and the step', /Looking at: .+ \(\d+ of \d+\)/.test(a.line), a.line);
  ok('panel shows a time left in plain words', /^(a few seconds left|about \d+ s left|more than a minute left|a little longer)$/.test(a.eta), a.eta);
  await p.screenshot({ path: `${out}/search-progress-1280.png` });
  await p.waitForTimeout(8000);
  const c = await read(p);
  ok('the bar only moves forward', !c || c.width > a.width, `${a.width} -> ${c?.width}`);
  // 2. Cancel stops it and the panel goes
  if (c) { await p.click('#search-cancel'); await p.waitForSelector('#search-progress', { state: 'detached', timeout: 10000 }); }
  ok('Cancel removes the panel', !(await read(p)));
  await p.close();
  // 3. a stored plan shows no panel
  const q = await open('training');
  await q.waitForTimeout(6000);
  ok('a stored plan shows no panel', !(await read(q)));
  await q.close();
  // 4. the switch
  const s = await open('bars', '&searchpanel=0');
  await s.waitForTimeout(6000);
  ok('?searchpanel=0 hides the panel', !(await read(s)));
  await s.close();
} finally { await b.close(); vite.kill(); }
process.exit(results.every(Boolean) ? 0 : 1);
