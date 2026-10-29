// CC-139: a phone-sized touch browser clears two courses with taps and holds only; the buttons are hidden on a computer. One browser at a time.
import { chromium } from 'playwright';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'test-results/share-touch'; mkdirSync(out, { recursive: true });
const port = Number(process.env.PORT ?? 5883);
const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 6000));
const base = `http://localhost:${port}`;
const results = []; const ok = (n, p, note = '') => { results.push(p); console.log(p ? 'PASS' : 'FAIL', n, note); };
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const errs = [];
const newPage = async (touch) => {
  const ctx = await b.newContext(touch ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true } : { viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e)));
  return { page, cdp: touch ? await ctx.newCDPSession(page) : null };
};
// fingers: id -> button id; every change sends the full set of points, as a real hand would
const fingers = new Map();
async function send(page, cdp, type) {
  const pts = [];
  for (const [id, btn] of fingers) {
    const r = await page.evaluate((s) => { const e = document.getElementById(s).getBoundingClientRect(); return { x: e.x + e.width / 2, y: e.y + e.height / 2 }; }, `touch-${btn}`);
    pts.push({ x: r.x, y: r.y, id });
  }
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
}
let nextId = 1;
async function press(page, cdp, btn) { const id = nextId++; fingers.set(id, btn); await send(page, cdp, 'touchStart'); return id; }
async function lift(page, cdp, id) { fingers.delete(id); await send(page, cdp, 'touchEnd'); }
const dist = (page) => page.evaluate(() => { const m = /([\d.]+) m of/.exec(document.body.innerText); return m ? Number(m[1]) : 0; });
async function finished(page) { return page.waitForSelector('#share-copy', { timeout: 90000 }).then(() => true).catch(() => false); }

// 1. a computer sees no buttons; ?touch=1 shows them there; ?touch=0 hides them on a phone
const desk = await newPage(false);
await desk.page.goto(`${base}/?course=/assets/demo/plank.course.json&welcome=0&tour=0`, { waitUntil: 'load' }); await desk.page.waitForTimeout(2500);
ok('a computer shows no touch buttons', !(await desk.page.$('#touch-pad')));
await desk.page.goto(`${base}/?course=/assets/demo/plank.course.json&welcome=0&tour=0&touch=1`, { waitUntil: 'load' }); await desk.page.waitForTimeout(2500);
ok('?touch=1 shows them on a computer', !!(await desk.page.$('#touch-pad')));
const off = await newPage(true);
await off.page.goto(`${base}/?course=/assets/demo/plank.course.json&welcome=0&tour=0&touch=0`, { waitUntil: 'load' }); await off.page.waitForTimeout(2500);
ok('?touch=0 hides them on a phone', !(await off.page.$('#touch-pad')));
await desk.page.context().close(); await off.page.context().close();

// 2. plank bridge: hold the right button the whole way
const t1 = await newPage(true);
await t1.page.goto(`${base}/?course=/assets/demo/plank.course.json&welcome=0&tour=0`, { waitUntil: 'load' });
await t1.page.waitForSelector('#touch-right', { timeout: 60000 }); await t1.page.waitForTimeout(1500);
ok('a phone shows the buttons (no cannon buttons here)', !!(await t1.page.$('#touch-jump')) && !(await t1.page.$('#touch-fire')));
await t1.page.screenshot({ path: `${out}/pad.png` });
const r = await press(t1.page, t1.cdp, 'right');
await t1.page.waitForTimeout(1500); await t1.page.screenshot({ path: `${out}/running.png` });
const done1 = await finished(t1.page);
await lift(t1.page, t1.cdp, r);
ok('plank bridge cleared by holding the right button; the run is proved and a link can be made', done1);
await t1.page.screenshot({ path: `${out}/plank-done.png` }); await t1.page.context().close();

// 3. two fingers at once: run held while jump is tapped; the page must see both keys down together, exactly as from a keyboard
const t2 = await newPage(true); fingers.clear();
await t2.page.goto(`${base}/?course=/assets/demo/lane-1.course.json&welcome=0&tour=0`, { waitUntil: 'load' });
await t2.page.waitForSelector('#touch-right', { timeout: 60000 }); await t2.page.waitForTimeout(1500);
await t2.page.evaluate(() => { window.__down = new Set(); window.__both = false; addEventListener('keydown', (e) => { window.__down.add(e.code); if (window.__down.has('ArrowRight') && window.__down.has('Space')) window.__both = true; }); addEventListener('keyup', (e) => window.__down.delete(e.code)); });
const run = await press(t2.page, t2.cdp, 'right');
await t2.page.waitForTimeout(800);
const j = await press(t2.page, t2.cdp, 'jump');
await t2.page.screenshot({ path: `${out}/two-fingers.png` });
await t2.page.waitForTimeout(150);
const bothDown = await t2.page.evaluate(() => window.__both);
await lift(t2.page, t2.cdp, j); await lift(t2.page, t2.cdp, run);
const left = await t2.page.evaluate(() => [...window.__down]);
ok('run and jump are down together, and every key is released when the fingers lift', bothDown && left.length === 0, JSON.stringify(left));
await t2.page.context().close();

// 4. a challenge link opened on a touch phone is playable, not watch-only
const link = execFileSync('node_modules/.bin/tsx', ['scripts/share-link.ts', 'public/assets/demo/lache.course.json', base]).toString().trim();
const t3 = await newPage(true);
await t3.page.goto(`${link}&welcome=0&tour=0`, { waitUntil: 'load' });
const banner = await t3.page.waitForSelector('#challenge-banner', { timeout: 60000 }).then((e) => e.innerText()).catch(() => '');
ok('a link on a touch phone says "Beat this time" and has the buttons', /Beat this time/.test(banner) && !!(await t3.page.$('#touch-pad')), banner.replace(/\n/g, ' | '));
await t3.page.screenshot({ path: `${out}/challenge-on-phone.png` });
ok('no page errors', errs.length === 0, errs.join(' | ').slice(0, 300));
await b.close(); vite.kill(); process.exit(results.every(Boolean) ? 0 : 1);
