// CC-133: the four pictures for the README "Course" screen, then one 2x2 composite (scripts/readme-shot-compose.py).
//   tile 1: the Training course, 45 degree camera pulled back, ghost just ahead, debug view on, Rookie A
//   tile 2: the Courses page (search, Start here, Real places, Real objects)
//   tile 3: Parts, "All parts" tab, first two rows of cards
//   tile 4: Parts, "How a course is made" tab, whole page
// Usage: PORT=5173 node scripts/readme-shot-course.mjs [tile1|tile2|tile3|tile4|all] [rawDir]
// Tiles 2 to 4 are real page captures at the zoom a person would get with Ctrl and minus (a bigger CSS viewport drawn onto 1280 x 800 real pixels, so text stays crisp).
// The raw tiles go to ../conquercourse-assets/readme-shots/course/ (not in git).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { Shot } from './film-lib.mjs';

const port = process.env.PORT ?? '5173';
const which = process.argv[2] ?? 'all';
const out = process.argv[3] ?? '../conquercourse-assets/readme-shots/course';
mkdirSync(out, { recursive: true });
const base = `http://localhost:${port}`;
const W = 1280, H = 800; // every tile is 16:10 at 1280 x 800 real pixels
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
  await page.keyboard.down('ArrowRight');
  const secs = Number(process.env.RUN_SECS ?? 2);
  await shot.advance(secs * 1000);
  await page.keyboard.up('ArrowRight');
  if (process.env.ZOOM_OUT) { await page.mouse.move(640, 420); await page.mouse.wheel(0, Number(process.env.ZOOM_OUT)); } // the wheel pulls the camera back to show more of the course
  await shot.advance(Number(process.env.AFTER_ZOOM_MS ?? 500)); // a short coast after the key is let go
  await page.evaluate(() => { const t = document.getElementById('toasts'); if (t) t.style.display = 'none'; }); // a passing hint must not cover the runner
  await shot.twoFrames(); // the page's own frames are stopped, so let the browser paint what was stepped
  await page.screenshot({ path: `${out}/tile1.png`, timeout: 180000 });
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
  await page.screenshot({ path: `${out}/${name}.png` });
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
if (want('tile4')) {
  await plain('tile4', '?mode=parts&backend=webgl2', Number(process.env.Z4 ?? 0.6), async (p) => {
    await p.waitForSelector('#pg-tab-course', { timeout: 120000 });
    await p.click('#pg-tab-course');
    await p.waitForTimeout(3000);
  });
}
