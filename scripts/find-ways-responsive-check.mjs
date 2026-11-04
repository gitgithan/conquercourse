// CC-133: "Find ways to add the missing moves" must not freeze the page. Boots the editor, clicks the button and watches a 50 ms probe tick.
// Usage: PORT=5199 node scripts/find-ways-responsive-check.mjs [outdir]   (set MAXGAP_MS to change the allowed gap, default 1000)
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const port = process.env.PORT ?? '5199', out = process.argv[2] ?? 'test-results/find-ways', maxGap = Number(process.env.MAXGAP_MS ?? 1000);
mkdirSync(out, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
let browser;
try {
  await new Promise((r) => setTimeout(r, 3000));
  browser = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/?mode=editor&welcome=0`);
  await page.waitForFunction(() => document.documentElement.dataset.laneClear !== undefined, null, { timeout: 180000 });
  await page.locator('#glossaryhide').click().catch(() => {});
  await page.click('#movesbtn');
  await page.evaluate(() => { const w = window; w.__gaps = []; let last = performance.now(); w.__probe = setInterval(() => { const n = performance.now(); w.__gaps.push(n - last); last = n; }, 50); });
  const t0 = Date.now();
  await page.click('#findways');
  await page.waitForFunction(() => document.documentElement.dataset.roleSuggestions !== undefined, null, { timeout: 300000 });
  const total = Date.now() - t0;
  const r = await page.evaluate(() => { clearInterval(window.__probe); return { maxGap: Math.max(...window.__gaps), ticks: window.__gaps.length, items: document.documentElement.dataset.roleSuggestions }; });
  console.log(JSON.stringify({ ...r, totalMs: total, errors }));
  await page.screenshot({ path: `${out}/find-ways.png` });
  assert.ok(r.maxGap < maxGap, `the page froze for ${Math.round(r.maxGap)} ms`);
  assert.equal(errors.length, 0, errors.join('; '));
} finally { await browser?.close(); server.kill(); }
