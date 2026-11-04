// CC-133: the four pictures for the README "Course" screen, each saved as its own 1920 x 1020 picture in README_MEDIA/.
//   tile 1 (picture 1): the Training run, camera turned behind the runner, low and a little to one side, debug panel hidden
//   end (picture 2): the end-of-run report (a win: the ideal-run bot clears the first course on the stepped clock)
//   tile2 (picture 3): the Courses page (search, Start here, Real places, Real objects)
//   tile3 (picture 4): Parts, "All parts" tab, first two rows of cards
// Usage: PORT=5461 node scripts/readme-shot-course.mjs [tile1|end|tile2|tile3|all] [rawDir]
// Pictures 3 and 4 are real page captures at the zoom a person would get with Ctrl and minus (a bigger CSS viewport drawn onto 1280 x 800 real pixels, so text stays crisp).
// Each tile is saved as its own 1920 x 1020 picture in README_MEDIA/ (clickable in the README).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { Shot } from './film-lib.mjs';

const port = process.env.PORT ?? '5173';
const which = process.argv[2] ?? 'all';
const out = process.argv[3] ?? 'README_MEDIA';
const NAMES = { tile1: 'course-1-training-run', end: 'course-2-end-screen', tile2: 'course-3-courses-page', tile3: 'course-4-parts-all' }; // owner 2026-11-04: new order, the end screen is tile 2
mkdirSync(out, { recursive: true });
const base = `http://localhost:${port}`;
const W = Number(process.env.W ?? 1920), H = Number(process.env.H ?? 1020); // owner 2026-11-04: every README tile is its own 1920 x 1020 picture in README_MEDIA/
const zoomOf = (z) => ({ viewport: { width: Math.round(W / z), height: Math.round(H / z) }, deviceScaleFactor: z }); // z = 0.67 is "Ctrl and minus" three times
const want = (n) => which === 'all' || which === n;
const flags = ['--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'];

async function tile1() {
  const shot = new Shot({ name: 'tile1', outDir: '/tmp/readme-course-film', fps: 30, width: W, height: H });
  const q = 'course=/assets/demo/training.course.json&rookie=a&nosave=1&cam=angle&debug=1&backend=webgl2&welcome=0&tour=0&sunat=noon';
  const page = await shot.open(`${base}/?${q}`, { cursor: false, noTransitions: false, waitReady: (p) => p.waitForSelector('html[data-ready=true]', { timeout: 240000 }) });
  shot.sub = 2;
  await page.evaluate(() => { try { localStorage.setItem('cc.next.seen', '1'); localStorage.removeItem('cc.ghost.mode'); } catch { /* ok */ } });
  await shot.advance(1500);
  const cam = await page.evaluate(() => document.getElementById('cam')?.title);
  if (!/45/.test(cam ?? '')) { await page.keyboard.press('KeyC'); await shot.advance(500); if (!/45/.test(await page.evaluate(() => document.getElementById('cam')?.title ?? ''))) await page.keyboard.press('KeyC'); }
  await page.keyboard.press('KeyH'); // hide the keys card
  // run right; the ghost (the ideal run) goes with us and pulls ahead
  await shot.advance(Number(process.env.START_DELAY ?? 600)); // stand still a moment, so the ghost (the ideal run) is just ahead
  if (process.env.DRAG) { const [dx, dy] = process.env.DRAG.split(',').map(Number); await page.mouse.move(W / 2, H / 2); await page.mouse.down(); await page.mouse.move(W / 2 + dx, H / 2 + dy, { steps: 8 }); await page.mouse.up(); } // turn the camera round the runner
  if (Number(process.env.RUN_SECS ?? 0) > 0) await page.keyboard.down('ArrowRight');
  const secs = Number(process.env.RUN_SECS ?? 0); // owner 2026-11-04: the runner stands at the start so the whole line of obstacles is ahead
  await shot.advance(secs * 1000);
  await page.keyboard.up('ArrowRight');
  if (process.env.ZOOM_OUT) { await page.mouse.move(640, 420); await page.mouse.wheel(0, Number(process.env.ZOOM_OUT)); } // the wheel pulls the camera back to show more of the course
  await shot.advance(Number(process.env.AFTER_ZOOM_MS ?? 500)); // a short coast after the key is let go
  await page.evaluate(() => { for (const id of ['toasts', 'debugpanel', 'leaderboard']) { const t = document.getElementById(id); if (t) t.style.display = 'none'; } }); // a passing hint must not cover the runner
  await shot.twoFrames(); // the page's own frames are stopped, so let the browser paint what was stepped
  await page.screenshot({ path: `${out}/${process.env.NAME1 ?? NAMES.tile1}.png`, timeout: 600000 });
  console.log('tile1', JSON.stringify(await page.evaluate(() => ({ x: document.documentElement.dataset.x, tick: document.documentElement.dataset.tick, cam: document.getElementById('cam')?.title, chip: document.getElementById('ghost-chip')?.textContent, debug: getComputedStyle(document.getElementById('debugpanel') ?? document.body).display }))));
  await shot.close();
}

async function plain(name, pathAndQuery, z, act) {
  const b = await chromium.launch({ args: flags });
  const ctx = await b.newContext(zoomOf(z));
  await ctx.addInitScript(() => { try { localStorage.setItem('cc.next.seen', '1'); } catch { /* ok */ } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 160)));
  await page.goto(`${base}/${pathAndQuery}`, { timeout: 240000 });
  await act(page);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/${NAMES[name]}.png` });
  console.log(name, 'size', await page.evaluate(() => `${innerWidth}x${innerHeight} scroll ${document.documentElement.scrollHeight}`));
  await b.close();
}

if (want('tile1')) await tile1();
if (want('tile2')) {
  await plain('tile2', '?course=/assets/demo/training.course.json&backend=webgl2&welcome=0&tour=0&sunat=noon', Number(process.env.Z2 ?? 0.8), async (p) => {
    await p.waitForSelector('#sitenav button', { timeout: 240000 });
    await p.click('#sitenav button'); // the Courses tab of the top bar
    await p.waitForSelector('#world-gallery .wg-grid', { timeout: 30000 });
  });
}
if (want('tile3')) {
  await plain('tile3', '?mode=parts&backend=webgl2', Number(process.env.Z3 ?? 0.67), async (p) => {
    await p.waitForSelector('[data-testid=parts-gallery] main *', { timeout: 120000 });
  });
}
if (want('end')) {
  const shot = new Shot({ name: 'end', outDir: '/tmp/readme-course-film', fps: 30, width: W, height: H });
  const q = `bot=ideal&nosave=1&backend=webgl2&welcome=0&tour=0&sunat=noon${process.env.END_COURSE ? `&course=${process.env.END_COURSE}` : ''}`; // no course word: the First course (short, gentle)
  const page = await shot.open(`${base}/?${q}`, { cursor: false, noTransitions: false, waitReady: (p) => p.waitForSelector('html[data-ready=true]', { timeout: 240000 }) });
  shot.sub = 2;
  await page.evaluate(() => { try { localStorage.setItem('cc.next.seen', '1'); } catch { /* ok */ } });
  for (let i = 0; i < 400; i++) { await shot.advance(1000); const o = await page.evaluate(() => document.documentElement.dataset.outcome); if (o && o !== 'running') { console.log('outcome', o, 'after', i + 1, 'game seconds'); break; } }
  await shot.advance(3000); await shot.twoFrames();
  await page.screenshot({ path: `${out}/${NAMES.end}.png`, timeout: 600000 });
  console.log('end saved', JSON.stringify(await page.evaluate(() => ({ outcome: document.documentElement.dataset.outcome, text: (document.body.innerText || '').slice(0, 300) }))));
  await shot.close();
}
