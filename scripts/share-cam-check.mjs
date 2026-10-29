// CC-137: make the clip of three courses and measure how tall the runner is in the frame. One browser at a time.
import { chromium } from 'playwright';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'test-results/share-cam'; mkdirSync(out, { recursive: true });
const port = Number(process.env.PORT ?? 5883);
const courses = (process.env.COURSES ?? 'lache,climb,drop').split(',');
const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 6000));
const results = []; const ok = (n, p, note = '') => { results.push(p); console.log(p ? 'PASS' : 'FAIL', n, note); };
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const errs = [];
for (const c of courses) {
  const link = execFileSync('node_modules/.bin/tsx', ['scripts/share-link.ts', `public/assets/demo/${c}.course.json`, `http://localhost:${port}`]).toString().trim();
  const page = await (await b.newContext({ viewport: { width: 1280, height: 720 }, acceptDownloads: true })).newPage();
  page.on('pageerror', (e) => errs.push(String(e)));
  const t0 = Date.now();
  await page.goto(`${link}&clip=auto&welcome=0&tour=0`, { waitUntil: 'load' });
  const dl = await page.waitForSelector('#clip-download', { timeout: 560000 }).then(() => true).catch(() => false);
  const frac = Number(await page.evaluate(() => document.documentElement.dataset.clipRunner ?? '0'));
  ok(`${c}: the runner is at least a third of the frame height in every picture`, dl && frac >= 1 / 3, `smallest ${frac.toFixed(3)}, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  if (dl) {
    const [d] = await Promise.all([page.waitForEvent('download'), page.click('#clip-download')]);
    await d.saveAs(`${out}/${c}.mp4`);
    try {
      for (const [i, s] of [[1, 1], [2, 4], [3, 7]]) execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(s), '-i', `${out}/${c}.mp4`, '-frames:v', '1', `${out}/${c}-${i}.png`]);
    } catch (e) { console.log('ffmpeg unavailable', String(e).slice(0, 60)); }
  }
  await page.context().close();
}
ok('no page errors', errs.length === 0, errs.join(' | ').slice(0, 300));
await b.close(); vite.kill(); process.exit(results.every(Boolean) ? 0 : 1);
