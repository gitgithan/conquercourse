// CC-163: top-right buttons vs the time line and the Restart chip at 390 and 1280; fails if any two overlap.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'test-results/narrow'; mkdirSync(out, { recursive: true });
const port = Number(process.env.PORT ?? 5890);
const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 6000));
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
let bad = 0;
for (const [w, h] of [[1280, 720], [390, 760]]) {
  const page = await b.newPage({ viewport: { width: w, height: h } });
  await page.goto(`http://localhost:${port}/?course=/assets/demo/training.course.json&welcome=0&tour=0`);
  await page.waitForSelector('#keys', { state: 'attached', timeout: 120000 }); await page.waitForTimeout(2500);
  const boxes = await page.evaluate(() => ['#hudrow > div', '#restart-chip', '#dojobtn', '#idealbtn', '#pickrunner', '#coursebtns', '#cam', '#debugbtn', '#ghost-hud', '#strip', '#community'].map((s) => { const e = document.querySelector(s); const r = e?.getBoundingClientRect(); return e && r && r.width > 0 && getComputedStyle(e).display !== 'none' ? { s, x: r.x, y: r.y, w: r.width, h: r.height } : null; }).filter(Boolean));
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const a = boxes[i], c = boxes[j]; if (a.x < c.x + c.w && c.x < a.x + a.w && a.y < c.y + c.h && c.y < a.y + a.h) { bad++; console.log('OVERLAP', w, a.s, c.s); } }
  console.log(w, boxes.length, 'boxes checked');
  await page.screenshot({ path: `${out}/top-${w}.png` }); await page.close();
}
console.log(bad ? 'FAIL' : 'PASS', bad, 'overlaps'); await b.close(); vite.kill(); process.exit(bad ? 1 : 0);
