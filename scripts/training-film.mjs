// A frame strip of the whole Training course chain played by the bot (the ideal run), one picture every few seconds, then the report. Usage: node scripts/training-film.mjs [outdir]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'data/eval/cc-97-courses'; mkdirSync(out, { recursive: true });
const port = 5885;
const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 6000));
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await b.newPage({ viewport: { width: 1024, height: 640 } });
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`http://localhost:${port}/?course=/assets/demo/training.course.json&bot=ideal&welcome=0`, { waitUntil: 'load' });
let i = 0, done = false;
for (let t = 0; t < 90 && !done; t++) {
  await page.waitForTimeout(5000);
  const state = await page.evaluate(() => ({ hud: document.querySelector('#hud')?.textContent ?? document.body.innerText.slice(0, 80), report: !!document.querySelector('#report-again') }));
  if (t % 2 === 0 || state.report) await page.screenshot({ path: `${out}/film-${String(i++).padStart(2, '0')}.png` });
  done = state.report;
}
console.log(done ? 'cleared, report shown' : 'no report', 'frames', i, errors.length ? 'errors: ' + errors.join(' | ').slice(0, 200) : 'no page errors');
await page.waitForTimeout(500); await page.screenshot({ path: `${out}/training-report.png` });
await b.close(); vite.kill();
process.exit(done && !errors.length ? 0 : 1);
