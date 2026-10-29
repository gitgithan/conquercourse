// CC-165: the time line has a fixed width (nothing beside it moves) and the default run screen has no R chip.
// Usage: PORT=5892 node scripts/chip-jitter-check.mjs [outdir]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'test-results/chip'; mkdirSync(out, { recursive: true });
const port = Number(process.env.PORT ?? 5892);
const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 6000));
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const results = []; const ok = (n, p, note = '') => { results.push(p); console.log(p ? 'PASS' : 'FAIL', n, note); };
async function open(q, w, h) {
  const page = await b.newPage({ viewport: { width: w, height: h } });
  await page.addInitScript(() => { try { localStorage.setItem('cc.next.seen', '1'); } catch { /* shots */ } });
  await page.goto(`http://localhost:${port}/?course=/assets/demo/training.course.json&welcome=0&tour=0${q}`);
  await page.waitForSelector('#keys', { state: 'attached', timeout: 120000 }); await page.waitForTimeout(2000);
  return page;
}
const box = (page, s) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x * 10) / 10, w: Math.round(r.width * 10) / 10, clipped: e.scrollWidth > e.clientWidth + 1 }; }, s);
for (const [w, h] of [[1280, 720], [390, 760]]) {
  const d = await open('', w, h);
  ok(`default run screen has no R chip (${w})`, (await d.locator('#restart-chip').count()) === 0);
  const widths = new Set(); const hudText = [];
  await d.keyboard.down('ArrowRight');
  for (let i = 0; i < 6; i++) { await d.waitForTimeout(1500); widths.add((await box(d, '#hudrow > div')).w); hudText.push(await d.locator('#hudrow > div').innerText()); }
  ok(`time line keeps one width while the time and metres change (${w})`, widths.size === 1, `${[...widths]} px; ${hudText[0]} ... ${hudText[5]}`);
  await d.screenshot({ path: `${out}/default-${w}.png` }); await d.close();
  const c = await open('&hud=restart', w, h);
  const xs = new Set(); let clipped = false;
  await c.keyboard.down('ArrowRight');
  for (let i = 0; i < 6; i++) { await c.waitForTimeout(1500); const bx = await box(c, '#restart-chip'); xs.add(bx.x); clipped ||= bx.clipped; }
  ok(`?hud=restart: the chip never moves (${w})`, xs.size === 1, [...xs].join(','));
  ok(`?hud=restart: the word Restart is not clipped (${w})`, !clipped && /Restart/.test(await c.locator('#restart-chip').innerText()));
  await c.screenshot({ path: `${out}/chip-switch-${w}.png` }); await c.close();
}
await b.close(); vite.kill(); process.exit(results.every(Boolean) ? 0 : 1);
