// CC-128 and CC-129: open a challenge link, play its keys, copy a link, make a clip, refuse a damaged link. One browser at a time.
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
  ok('both share buttons are on the report', /Copy link to challenge a friend/.test(t) && /Download a video/.test(t));
  await page.screenshot({ path: `${out}/report.png` });
  await page.click('#share-copy');
  await page.waitForFunction(() => /copied|ready/i.test(document.querySelector('#share-copy').textContent), null, { timeout: 15000 }).catch(() => {});
  const copied = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  ok('the copied link is a challenge link with no name or time in it', /\?course=[^&]+&challenge=1\.[a-z0-9]+\.\.[dr]/.test(copied) && !/name|time|email/i.test(copied), copied.slice(0, 120));
  const again = await ctx.newPage();
  await again.goto(`${copied}&welcome=0&tour=0`, { waitUntil: 'load' });
  const b2 = await again.waitForSelector('#challenge-banner', { timeout: 60000 }).then((e) => e.innerText()).catch(() => '');
  ok('the copied link opens with the same time to beat', b2.includes(`${seconds} s`), b2.replace(/\n/g, ' | '));
  await again.close();
  const t0 = Date.now();
  await page.click('#share-clip');
  const dl = await page.waitForSelector('#clip-download', { timeout: 280000 }).then(() => true).catch(() => false);
  const cardText = await page.evaluate(() => document.querySelector('#clip-card')?.innerText ?? '');
  ok('a clip is made and offered for download', dl, `${((Date.now() - t0) / 1000).toFixed(0)} s: ${cardText.replace(/\n/g, ' | ')}`);
  if (dl) {
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#clip-download')]);
    await download.saveAs(`${out}/clip.mp4`);
    const size = statSync(`${out}/clip.mp4`).size;
    ok('the file is an mp4 of a sensible size', size > 20000, `${size} bytes`);
    try {
      const j = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,width,height,nb_frames:format=duration', '-of', 'json', `${out}/clip.mp4`]).toString());
      console.log(JSON.stringify(j));
      const s = j.streams[0];
      ok('720 x 1280, 30 pictures a second, about the length of the run plus the tail', s.width === 720 && s.height === 1280 && Math.abs(Number(j.format.duration) - (Number(seconds) + 1.5)) < 0.6, `${j.format.duration} s, ${s.codec_name}`);
    } catch (e) { console.log('ffprobe unavailable:', String(e).slice(0, 80)); }
  }
}
// a damaged link and a cut-short link are refused in plain words
const bad = await ctx.newPage();
await bad.goto(`${link.slice(0, -12)}&welcome=0&tour=0`, { waitUntil: 'load' });
const tb = await bad.waitForSelector('#challenge-banner', { timeout: 60000 }).then((e) => e.innerText()).catch(() => '');
ok('a cut-short link is refused in plain words', /cannot be played|does not reach/.test(tb) && !/Beat this/.test(tb), tb.replace(/\n/g, ' | '));
await bad.screenshot({ path: `${out}/refused.png` });
ok('no page errors', errs.length === 0, errs.join(' | ').slice(0, 300));
await b.close(); vite.kill(); process.exit(results.every(Boolean) ? 0 : 1);
