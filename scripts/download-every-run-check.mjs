// CC-157: a try on a ready-made course can be saved as a clip, also after a fall and also when it began at a checkpoint.
// For each course: run right and jump at random, wait for the fall panel, see the clip button; press R (a checkpoint start), fall again, see it again.
// The first course (and any in CLIPS) also makes the clip and checks the file. One browser at a time (run it on the VM).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
const out = process.argv[2] ?? 'test-results/download-every-run'; mkdirSync(out, { recursive: true });
const port = Number(process.env.PORT ?? 5884);
const courses = (process.env.COURSES ?? ',training,lache,climb,band,cannon').split(',');
const clipFor = new Set((process.env.CLIPS ?? 'training').split(','));
const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 6000));
const results = []; const ok = (n, p, note = '') => { results.push(p); console.log(p ? 'PASS' : 'FAIL', n, note); };
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
for (const c of courses) {
  const name = c || 'default';
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, acceptDownloads: true });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => { if (!/popErrorScope/.test(String(e))) errs.push(String(e)); });
  await page.goto(`http://localhost:${port}/?${c ? `course=/assets/demo/${c}.course.json&` : ''}welcome=0&tour=0`, { waitUntil: 'load' });
  await page.waitForSelector('#keys', { state: 'attached', timeout: 120000 });
  await page.waitForTimeout(2500);
  for (const round of ['first fall', 'retry after the fall']) {
    await page.keyboard.down('ArrowRight');
    let seen = false; // jump now and then; stop pressing the moment the panel shows (Space would press its focused button)
    for (let k = 0; k < 220 && !seen; k++) {
      seen = await page.locator('#share-clip-fall, #share-clip').first().isVisible();
      if (!seen) { await page.keyboard.press('Space'); await page.waitForTimeout(900); }
    }
    await page.keyboard.up('ArrowRight');
    ok(`${name}: clip button on the fall or cleared panel (${round})`, seen);
    if (round === 'first fall') await page.screenshot({ path: `${out}/${name}-fall.png` });
    if (!seen) break;
    if (round === 'first fall' && clipFor.has(c)) {
      await page.click('#share-clip-fall, #share-clip');
      const dl = await page.waitForSelector('#clip-download', { timeout: 280000 }).then(() => true).catch(() => false);
      ok(`${name}: the clip is offered for download`, dl);
      if (dl) {
        const [download] = await Promise.all([page.waitForEvent('download'), page.click('#clip-download')]);
        await download.saveAs(`${out}/${name}-fall.mp4`);
        const size = statSync(`${out}/${name}-fall.mp4`).size;
        ok(`${name}: the file is an mp4 of a sensible size`, size > 20000, `${size} bytes`);
      }
      await page.waitForTimeout(1500);
    } else {
      await page.keyboard.press('KeyR'); // from the checkpoint the next try starts
    }
    await page.waitForTimeout(800);
  }
  ok(`${name}: no page errors`, errs.length === 0, errs.join(' | ').slice(0, 200));
  await ctx.close();
}
await b.close(); vite.kill(); process.exit(results.every(Boolean) ? 0 : 1);
