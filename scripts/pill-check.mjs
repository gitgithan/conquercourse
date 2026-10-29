// CC-166: finds empty dark boxes ("pills") over the picture while playing the Training course, at several moments.
// Usage: PORT=5890 node scripts/pill-check.mjs [outdir]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'test-results/pill'; mkdirSync(out, { recursive: true });
const port = Number(process.env.PORT ?? 5891);
const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 6000));
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { try { localStorage.setItem('cc.next.seen', '1'); } catch { /* shots */ } });
await page.goto(`http://localhost:${port}/?course=/assets/demo/training.course.json&welcome=0&tour=0`);
await page.waitForSelector('#keys', { state: 'attached', timeout: 120000 }); await page.waitForTimeout(2500);
let bad = 0;
const scan = () => page.evaluate(() => [...document.body.querySelectorAll('*')].filter((e) => {
  const c = getComputedStyle(e), r = e.getBoundingClientRect();
  if (c.display === 'none' || c.visibility === 'hidden' || r.width < 4 || r.height < 4 || c.position !== 'fixed') return false;
  const bg = c.backgroundColor.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0];
  const dark = (bg[3] ?? 1) > 0.5 && bg[0] + bg[1] + bg[2] < 200;
  return dark && !e.textContent.trim() && !e.querySelector('svg,img,canvas,kbd');
}).map((e) => `${e.tagName}#${e.id} ${Math.round(e.getBoundingClientRect().x)},${Math.round(e.getBoundingClientRect().y)} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`));
const shots = ['start', 'run1', 'run2', 'run3', 'jump'];
for (const [i, name] of shots.entries()) {
  if (i === 1 || i === 2 || i === 3) { await page.keyboard.down('ArrowRight'); await page.waitForTimeout(2500); }
  if (i === 4) await page.keyboard.press('Space');
  const found = await scan(); bad += found.length; console.log(name, found.length ? 'PILL ' + found.join(' | ') : 'no empty dark box');
  await page.screenshot({ path: `${out}/${name}.png` }); await page.waitForTimeout(200);
}
console.log(bad ? 'FAIL' : 'PASS', bad); await b.close(); vite.kill(); process.exit(bad ? 1 : 0);
