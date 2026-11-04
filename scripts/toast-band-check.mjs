// CC-133: the hint, the toasts and the dimmed older hints sit in the sky band at the top-centre, never over the runner or the HUD (1280 x 720, desktop).
// Usage (on a VM): OUT=docs/evidence/cc-133-bulbs-toasts node scripts/toast-band-check.mjs
// Shots: the bulb course on the run-up with the pole toast, the climb up the pole, and another course (the bars) with a toast in the same place.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? String(5300 + Math.floor(Math.random() * 600)), out = process.env.OUT ?? 'docs/evidence/cc-133-bulbs-toasts';
mkdirSync(out, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const results = []; const check = (name, ok, extra = '') => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, extra); };
const flags = ['--use-angle=swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
const boxes = (page) => page.evaluate(() => {
  const r = (e) => { const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right }; };
  const band = document.getElementById('toast-band');
  const kids = band ? [...band.querySelectorAll('div')].filter((e) => e.offsetHeight > 0 && e.children.length === 0 && e.textContent.trim()).map((e) => ({ t: e.textContent.slice(0, 30), ...r(e) })) : [];
  const others = ['strip', 'coursebtns', 'ghost-hud', 'hud'].map((id) => document.getElementById(id)).filter(Boolean).map((e) => ({ id: e.id, ...r(e) }));
  return { band: band ? r(band) : null, kids, others, vh: innerHeight, hint: document.documentElement.dataset.mode };
});
const hit = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
const verify = (tag, b, limit = 0.5) => {
  check(`${tag}: the band exists`, !!b.band);
  check(`${tag}: its top is in the top third (under the strip and the ghost chip)`, b.band.top <= 0.34 * b.vh, `top ${b.band.top}`);
  check(`${tag}: its bottom is above the runner's head (under ${Math.round(limit * 100)}%)`, b.band.bottom <= limit * b.vh + 1, `bottom ${b.band.bottom}`);
  check(`${tag}: no message touches the strip or the buttons`, b.kids.every((k) => b.others.every((o) => !hit(k, o))), JSON.stringify(b.kids.map((k) => k.t)));
};
// a software GPU draws a frame slowly, so the game moves on while a screenshot is taken; freezing the page clock holds the picture still
const freeze = (page) => page.evaluate(() => { window.__realNow = performance.now.bind(performance); const t = performance.now(); performance.now = () => t; });
const play = async (page, url, until) => {
  await page.goto(`http://localhost:${port}/${url}`);
  await page.waitForSelector('html[data-ready=true]', { state: 'attached', timeout: 180000 });
  await page.waitForTimeout(1500);
  await until();
};
try {
  await new Promise((r) => setTimeout(r, 5000));
  const browser = await chromium.launch({ args: flags });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const x = () => page.evaluate(() => Number(document.documentElement.dataset.x));
  // 0. the drum on the pole says what to do (CC-133: the owner saw no instruction on the drums): run a little, stop, look at the lane
  await play(page, '?course=/assets/demo/fork-bench-bulb.course.json&welcome=0&tour=0&backend=webgl2&sunat=noon', async () => {
    await page.keyboard.down('ArrowRight');
    await page.waitForFunction(() => Number(document.documentElement.dataset.x) >= 3.5, null, { timeout: 120000 });
    await page.keyboard.up('ArrowRight');
    await page.waitForTimeout(5000);
    const drum = await page.evaluate(() => { const e = [...document.querySelectorAll('#drums div')].find((d) => /Hold E to climb the pole/.test(d.textContent) && d.children.length === 1); if (!e) return null; const r = e.getBoundingClientRect(), l = document.getElementById('drums').getBoundingClientRect(); return { shown: getComputedStyle(e).display !== 'none', inLane: r.left >= l.left && r.right <= l.right && r.top >= l.top && r.bottom <= l.bottom, left: r.left, right: r.right, x: Number(document.documentElement.dataset.x) }; });
    console.log(JSON.stringify(drum));
    check('bulbs: the pole drum reads "Hold E to climb the pole" and sits inside the drum lane', !!drum && drum.shown && drum.inLane, JSON.stringify(drum));
    await page.screenshot({ path: `${out}/bulbs-pole-drum.png` });
  });
  // 1. the bulb course: the pole toast on the run-up, then the climb
  await play(page, '?course=/assets/demo/fork-bench-bulb.course.json&welcome=0&tour=0&backend=webgl2&sunat=noon', async () => {
    await page.keyboard.down('e'); // E held from the start: the hands close on the pole as the runner passes it
    await page.keyboard.down('ArrowRight');
    await page.waitForFunction(() => Number(document.documentElement.dataset.x) >= 5.5, null, { timeout: 120000 });
    const b = await boxes(page); console.log(JSON.stringify(b.kids));
    await page.screenshot({ path: `${out}/bulbs-pole-toast.png` });
    verify('bulbs run-up', b);

    check('bulbs run-up: the pole toast is on screen', b.kids.some((k) => /pole/i.test(k.t)), JSON.stringify(b.kids));
    await page.waitForFunction(() => document.documentElement.dataset.mode === 'polec' || document.documentElement.dataset.mode === 'hang', null, { timeout: 20000, polling: 'raf' }).catch(() => {});
    check('bulbs high path: the runner took the pole up to the bars (mode polec or hang)', ['polec', 'hang'].includes(await page.evaluate(() => document.documentElement.dataset.mode)), await page.evaluate(() => document.documentElement.dataset.x));
    await page.waitForTimeout(600);
    const c = await boxes(page); console.log(c.hint, JSON.stringify(c.kids));
    await page.screenshot({ path: `${out}/bulbs-high-path.png` });
    verify('bulbs high path', c, 0.54); // a three-line hint is taller; the runner's head is at about 54%
    await page.keyboard.up('e'); await page.keyboard.up('ArrowRight');
  });
  // 2. another course: a bar course shows its toast in the same place
  await play(page, '?course=/assets/demo/lache.course.json&welcome=0&tour=0&backend=webgl2&sunat=noon', async () => {
    await page.keyboard.down('ArrowRight');
    let b = null;
    for (let i = 0; i < 80 && !(b?.kids.length); i++) { await page.waitForTimeout(250); b = await boxes(page); }
    await page.screenshot({ path: `${out}/lache-toast.png` });
    console.log(JSON.stringify(b.kids));
    check('lache: a message is showing', b.kids.length > 0);
    verify('lache', b);
  });
  // 3. the monkey bars: the Q and T keys join the band, above the hint
  await play(page, '?course=/assets/demo/bars.course.json&welcome=0&tour=0&backend=webgl2&sunat=noon', async () => {
    await page.keyboard.down('ArrowRight');
    let b = null;
    for (let i = 0; i < 120 && !(b?.kids.length); i++) { await page.waitForTimeout(250); b = await boxes(page); }
    await page.screenshot({ path: `${out}/bars-toast.png` });
    console.log(JSON.stringify(b.kids));
    check('bars: a message is showing', b.kids.length > 0);
    verify('bars', b);
  });
  // 4. N-back with N = 2: three messages in a row; the current one in the main slot, the 2 before it dimmed above it, older dimmer
  await play(page, '?course=/assets/demo/lache.course.json&welcome=0&tour=0&backend=webgl2&sunat=noon&check=1', async () => {
    await page.waitForTimeout(4000); // let the course settle: a restart at the start clears the toasts
    const msgs = ['First message', 'Second message', 'Third message', 'Fourth message'];
    for (let i = 0; i < msgs.length; i++) {
      await page.evaluate((m) => window.__say(m, 3000), msgs[i]);
      // wait until the page has drawn this message in the main slot AND moved the one before it up (one frame can take a second on a software GPU)
      await page.waitForFunction(([m, before]) => { const e = [...document.querySelectorAll('#toasts .toast')].find((x) => x.offsetHeight > 0); const h = document.querySelector('#toast-history > div:last-child'); return !!e && e.textContent === m && (before ? !!h && h.textContent === before : true); }, [msgs[i], msgs[i - 1] ?? null], { timeout: 90000 });
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))); // two frames: the page has surely run its update
    }
    // sampled right away: the dimmed rows fade after 9 s of wall time, and a software GPU draws a frame slowly
    await freeze(page);
    await page.screenshot({ path: `${out}/nback-toasts.png`, animations: 'disabled' });
    const n = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('#toast-history > div')].map((e) => { const b = e.getBoundingClientRect(); return { t: e.textContent, top: e.offsetTop, bottom: e.offsetTop + e.offsetHeight, o: Number(e.style.opacity) }; });
      const main = [...document.querySelectorAll('#toasts .toast')].filter((e) => e.offsetHeight > 0).map((e) => { const b = e.getBoundingClientRect(); return { t: e.textContent, top: e.offsetTop, bottom: b.bottom }; });
      const hint = document.querySelector('#toast-band > div:not([id])'); return { rows, main, hintShown: !!hint && hint.offsetHeight > 0 && hint.textContent.trim() !== '', vh: innerHeight };
    });
    console.log(JSON.stringify(n));
    check('n-back: the main slot holds only the newest message', n.main.length === 1 && n.main[0].t === 'Fourth message', JSON.stringify(n.main));
    check('n-back: the 2 before it sit above it, oldest on top', n.rows.length === 2 && n.rows[0].t === 'Second message' && n.rows[1].t === 'Third message' && n.rows[1].bottom <= n.main[0].top + 1, JSON.stringify(n.rows));
    check('n-back: the older, the dimmer', n.rows.length === 2 && n.rows[0].o < n.rows[1].o && n.rows[1].o < 1, JSON.stringify(n.rows.map((r) => r.o)));
    check('n-back: the hint steps aside while a toast holds the main slot', !n.hintShown);
    check('n-back: all of it ends above 50% of the height (clear of the runner)', n.main[0].bottom <= 0.5 * n.vh, `bottom ${n.main[0].bottom}`);
  });
  await browser.close();
} catch (e) { console.log('FAIL error', e.message); results.push(false); }
server.kill();
process.exit(results.every(Boolean) && results.length ? 0 : 1);
