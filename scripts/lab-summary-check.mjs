// The summary box on every Lab at 1280 px: it is there, sits under the Labs strip, is at most about 3 lines tall, and covers nothing.
// Screenshots (top of three Labs) go to test-results/lab-summary/. Run: PORT=5190 node scripts/lab-summary-check.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
const port = process.env.PORT ?? '5190';
const modes = [...readFileSync('src/ui/labs-summary.ts', 'utf8').matchAll(/^  '(lab-[a-z]+)': \{/gm)].map((m) => m[1]);
const shots = new Set(['lab-search', 'lab-camera', 'lab-limits']);
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
let failed = false;
try {
  await new Promise((r) => setTimeout(r, 4000));
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  mkdirSync('test-results/lab-summary', { recursive: true });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  for (const m of modes) {
    await page.goto(`http://localhost:${port}/?mode=${m}&labs=1&welcome=0&backend=webgl2&sunat=noon`);
    try { await page.waitForSelector('#lab-summary', { timeout: 90000 }); } catch { console.log(m, 'FAILED no summary box'); failed = true; continue; }
    const r = await page.evaluate(() => {
      const b = document.getElementById('lab-summary').getBoundingClientRect(), n = document.getElementById('labs-nav').getBoundingClientRect();
      const next = document.getElementById('lab-summary').nextElementSibling?.getBoundingClientRect();
      return { h: Math.round(b.height), belowNav: b.top >= n.bottom - 1, noOverlap: !next || next.top >= b.bottom - 1, w: Math.round(b.width) };
    });
    const ok = r.h <= 110 && r.belowNav && r.noOverlap;
    console.log(m, ok ? 'ok' : 'FAILED', JSON.stringify(r)); if (!ok) failed = true;
    if (shots.has(m)) await page.screenshot({ path: `test-results/lab-summary/${m}.png`, clip: { x: 0, y: 0, width: 1280, height: 420 } });
  }
  await browser.close();
} finally { server.kill(); }
process.exit(failed ? 1 : 0);
