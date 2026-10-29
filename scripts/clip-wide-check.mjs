// CC-160: make the clip of three courses in three views (close, 20 m tall, 20 m wide) and measure the metres across and the runner's share. One browser at a time.
// node scripts/clip-wide-check.mjs [outDir]   (COURSES=training,park-run,climb  VIEWS=close,tall,wide)
import { chromium } from 'playwright';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = process.argv[2] ?? 'test-results/clip-wide'; mkdirSync(out, { recursive: true });
const port = Number(process.env.PORT ?? 5884);
const courses = (process.env.COURSES ?? 'training,park-run,climb').split(',');
const views = (process.env.VIEWS ?? 'close,tall,wide').split(',');
const extra = { close: '&clipzoom=close', tall: '', wide: '&clipshape=wide' };
const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 6000));
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const results = []; const errs = [];
for (const c of courses) for (const v of views) {
  const link = execFileSync('node_modules/.bin/tsx', ['scripts/share-link.ts', `public/assets/demo/${c}.course.json`, `http://localhost:${port}`]).toString().trim();
  const page = await (await b.newContext({ viewport: { width: 1280, height: 720 }, acceptDownloads: true })).newPage();
  page.on('pageerror', (e) => errs.push(String(e)));
  const t0 = Date.now();
  await page.goto(`${link}&clip=auto&welcome=0&tour=0&music=0${extra[v]}`, { waitUntil: 'load' });
  const dl = await page.waitForSelector('#clip-download', { timeout: 900000 }).then(() => true).catch(() => false);
  const [share, metres] = await page.evaluate(() => [document.documentElement.dataset.clipRunner ?? '0', document.documentElement.dataset.clipMetres ?? '0']);
  const file = `${out}/${c}-${v}.mp4`;
  if (dl) {
    const [d] = await Promise.all([page.waitForEvent('download'), page.click('#clip-download')]);
    await d.saveAs(file);
    const secs = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString());
    [0.2, 0.5, 0.8].forEach((f, i) => execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String((secs * f).toFixed(2)), '-i', file, '-frames:v', '1', `${out}/${c}-${v}-${i + 1}.png`]));
  }
  const row = { course: c, view: v, made: dl, metresAcross: Number(metres), runnerShareOfPicture: Number(share), seconds: Math.round((Date.now() - t0) / 1000) };
  console.log(JSON.stringify(row)); results.push(row);
  await page.context().close();
}
writeFileSync(`${out}/run.json`, JSON.stringify({ experiment: 'cc-160-clip-wide', date: new Date().toISOString().slice(0, 10), script: 'scripts/clip-wide-check.mjs', viewport: '1280x720', results, pageErrors: errs.slice(0, 5) }, null, 2) + '\n');
console.log('page errors', errs.length);
await b.close(); vite.kill(); process.exit(results.every((r) => r.made) && errs.length === 0 ? 0 : 1);
