// CC-116: a coaster run ends with the same you-and-best-line report (needs the stored brake plan).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'data/eval/cc-116'; mkdirSync(out, { recursive: true });
const port = Number(process.env.PORT ?? 5879);
const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 6000));
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const results = []; const ok = (n, p, note = '') => { results.push(p); console.log(p ? 'PASS' : 'FAIL', n, note); };
for (const c of ['coaster-two-hills']) {
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`http://localhost:${port}/?course=/assets/demo/${c}.course.json&bot=ideal&welcome=0`, { waitUntil: 'load' });
  const got = await page.waitForSelector('#report-again', { timeout: 240000 }).then(() => true).catch(() => false);
  ok(`${c}: the report appears after the best run`, got);
  if (got) {
    const t = await page.evaluate(() => document.querySelector('section[aria-label="Run report"]').innerText);
    ok(`${c}: you next to the best line`, /Best line/.test(t) && /Time/.test(t), t.replace(/\n+/g, ' | ').slice(0, 200));
    ok(`${c}: no effort row for a cart ride`, !/Effort/.test(t));
    ok(`${c}: says what the course teaches`, /coaster climbs no higher/.test(t));
    ok(`${c}: the best-line button is there`, /Watch the best line/.test(t));
    await page.screenshot({ path: `${out}/${c}-report.png` });
  }
  ok(`${c}: no page errors`, errs.length === 0, errs.join(' | ').slice(0, 200));
  await page.close();
}
await b.close(); vite.kill(); process.exit(results.every(Boolean) ? 0 : 1);
