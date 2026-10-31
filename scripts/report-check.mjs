// CC-158: the end report: NAME box, no Close or Chase buttons, a click outside acts like R. Shot at 1280 x 720.
import { chromium } from 'playwright';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
const out = process.argv[2] ?? 'test-results/share'; mkdirSync(out, { recursive: true });
const port = Number(process.env.PORT ?? 5883);
const course = process.env.COURSE ?? 'public/assets/demo/lache.course.json';
const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 6000));
const link = execFileSync('node_modules/.bin/tsx', ['scripts/share-link.ts', course, `http://localhost:${port}`]).toString().trim();
console.log('link chars:', link.length);
const results = []; const ok = (n, p, note = '') => { results.push(p); console.log(p ? 'PASS' : 'FAIL', n, note); };
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, permissions: ['clipboard-read', 'clipboard-write'], acceptDownloads: true });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
await page.goto(`${link}&autoplay=1&welcome=0&tour=0`, { waitUntil: 'load' });
const banner = await page.waitForSelector('#challenge-banner', { timeout: 60000 }).then((e) => e.innerText()).catch(() => '');
ok('the banner says what to beat', /Beat this time: \d+\.\d\d s/.test(banner), banner.replace(/\n/g, ' | '));
const seconds = banner.match(/(\d+\.\d\d) s/)?.[1];
await page.screenshot({ path: `${out}/banner.png` });
const got = await page.waitForSelector('#report-again', { timeout: 300000 }).then(() => true).catch(() => false);
ok('the friend\'s keys played as a run end in the report', got);
if (got) {
  const t = await page.evaluate(() => document.querySelector('section[aria-label="Run report"]').innerText);
  ok('the report names the friend\'s run', /friend/.test(t), t.replace(/\n+/g, ' | ').slice(0, 260));
  ok('both share buttons are on the report', /Copy link to challenge a friend/.test(t) && /Download/.test(t));
  ok('no Close, More or Chase button', !/Close|More|Chase/.test(t), t.replace(/\n+/g, ' | ').slice(0, 300));
  ok('the name box says NAME', await page.getAttribute('#share-nick', 'placeholder') === 'NAME');
  await page.screenshot({ path: `${out}/report.png` });
  await page.mouse.click(8, 400);
  await page.waitForTimeout(800);
  ok('a click outside closes the report', !(await page.isVisible('#report-again')));
}
await b.close(); vite.kill();
process.exit(results.every(Boolean) ? 0 : 1);
