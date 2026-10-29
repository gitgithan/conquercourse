// CC-158: the end report, old layout (?report=old) and new, at 1280 and 390 wide. A friend's run from a challenge link plays to the end, so the report has every button.
// Usage: node scripts/report-shots.mjs [outdir]   (one browser at a time; run it on the VM)
import { chromium } from 'playwright';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'test-results/report'; mkdirSync(out, { recursive: true });
const port = Number(process.env.PORT ?? 5887);
const course = process.env.COURSE ?? 'public/assets/demo/lache.course.json';
const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 6000));
const link = execFileSync('node_modules/.bin/tsx', ['scripts/share-link.ts', course, `http://localhost:${port}`]).toString().trim();
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
let bad = 0;
for (const layout of ['old', 'new']) for (const [w, h] of [[1280, 720], [390, 760]]) {
  const page = await b.newPage({ viewport: { width: w, height: h } });
  await page.addInitScript(() => { try { localStorage.setItem('cc.next.seen', '1'); } catch { /* shots only */ } }); // the one-time What next card would cover the report
  await page.goto(`${link}&autoplay=1&welcome=0&tour=0&next=0${w < 600 ? '&touch=1' : ''}${layout === 'old' ? '&report=old' : ''}`, { waitUntil: 'load' });
  const got = await page.waitForSelector('#report-again', { timeout: 300000 }).then(() => true).catch(() => false);
  if (!got) { console.log('FAIL no report', layout, w); bad++; await page.close(); continue; }
  await page.waitForTimeout(800);
  const info = await page.evaluate(() => ({ buttons: [...document.querySelectorAll('section[aria-label="Run report"] button, section[aria-label="Run report"] input')].length, share: !!document.querySelector('#report-share'), text: document.querySelector('section[aria-label="Run report"]').innerText.replace(/\n+/g, ' | ').slice(0, 400) }));
  console.log(layout, w, JSON.stringify(info));
  await page.screenshot({ path: `${out}/report-${layout}-${w}.png` });
  await page.close();
}
await b.close(); vite.kill(); process.exit(bad ? 1 : 0);
