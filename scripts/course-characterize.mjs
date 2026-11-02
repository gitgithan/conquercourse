// Characterization of the Course screen: loads shipped courses, presses every key the Course handles, runs a fall and a clear, opens the report, the Courses picker and the editor handoff,
// and writes what it sees as JSON. Run it before and after a refactor and diff the two files (node scripts/course-characterize.mjs out.json).
// It is a refactor safety net (CC-133), not a pass/fail check. The page clock is stepped by the script (the films' trick), so the game runs the same ticks every time.
// It records words, ids and states; numbers that move per machine are turned into '#'. Mouse-only things (drag, camera orbit) and the look of the picture are not covered.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const out = process.argv[2] ?? 'test-results/course-characterize.json';
const port = process.env.PORT ?? '5173';
const base = `http://localhost:${port}/`;
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
// the page's animation frames and its clock move only when this script says so (same idea as scripts/film-lib.mjs)
const STEPPED = `(() => {
  let t = 0, queue = [], id = 0;
  performance.now = () => t;
  window.requestAnimationFrame = (cb) => { queue.push([++id, cb]); return id; };
  window.cancelAnimationFrame = (i) => { queue = queue.filter((q) => q[0] !== i); };
  window.__adv = (ms, step) => { for (let left = ms; left > 0; left -= step) { t += Math.min(step, left); const q = queue; queue = []; for (const [, cb] of q) { try { cb(t); } catch (e) { console.error(e); } } } return t; };
  document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '*,*::before,*::after{transition:none !important;animation:none !important}'; document.head.appendChild(s); });
})();`;

const browser = await chromium.launch({ args: flags });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, permissions: ['clipboard-read', 'clipboard-write'], acceptDownloads: true });
await ctx.addInitScript(STEPPED);
await ctx.addInitScript(() => { try { localStorage.setItem('cc.worldWelcome.seen', '1'); } catch {} });
let page = null;
const errors = [];
// every section gets its own page: a page that has just fallen can be busy searching for a long time
async function fresh() { const old = page; page = await ctx.newPage(); page.setDefaultTimeout(30000); page.on('pageerror', (e) => errors.push(e.message.slice(0, 160))); if (old) old.close({ runBeforeUnload: false }).catch(() => {}); }
await fresh();
const steps = [];

const adv = (ms, step = 100) => page.evaluate(([m, s]) => window.__adv(m, s), [ms, step]);
// advance game time until the test is true (checked every 0.5 s of game time), at most maxMs of game time
async function until(test, maxMs = 30000, arg = null) {
  for (let t = 0; t <= maxMs; t += 500) {
    if (await page.evaluate(test, arg)) return true;
    await adv(500);
    await page.waitForTimeout(20);
  }
  return false;
}
async function ready() {
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', null, { timeout: 240000, polling: 200 });
  for (let i = 0; i < 400; i++) { await adv(100); if (await page.evaluate(() => document.documentElement.dataset.tick !== undefined)) break; await page.waitForTimeout(150); }
  await adv(1000); // the same game time before the first picture, however slowly the page got ready
}
async function open(query) {
  await fresh();
  await page.goto(`${base}?${query}`, { waitUntil: 'load', timeout: 240000 });
  await ready();
}
const key = async (code, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(code); await adv(100); } };
const click = async (sel) => { await page.evaluate((s) => document.querySelector(s).click(), sel); await adv(200); };

async function snap(name, extra = {}, keepToasts = false) {
  const s = await page.evaluate((keepToasts) => {
    const norm = (t) => t.replace(/\s+/g, ' ').trim().replace(/\d+(\.\d+)?/g, '#');
    const vis = (e) => { const r = e.getBoundingClientRect(); const st = getComputedStyle(e); return r.width > 0 && r.height > 0 && st.display !== 'none' && st.visibility !== 'hidden' && Number(st.opacity) > 0; };
    const skip = (e) => ['graphchip', 'lane-cancel', 'lane-anyway'].includes(e.id); // timers on the wall clock, not the game's
    const buttons = [...document.querySelectorAll('button,select,input,a[href]')].filter((e) => vis(e) && !skip(e)).map((e) => `${e.id || e.tagName.toLowerCase()}|${norm(e.innerText || e.value || e.getAttribute('aria-label') || '').slice(0, 40)}${e.disabled ? '|disabled' : ''}`);
    const cards = [...document.body.children].filter((e) => !['CANVAS', 'SCRIPT', 'STYLE', 'LINK'].includes(e.tagName) && vis(e) && !skip(e) && (keepToasts || e.id !== 'toasts') && norm(e.innerText ?? '')).map((e) => `${e.id || e.tagName.toLowerCase()}: ${e.id === 'drums' ? 'Drums (G)' : norm(e.innerText).slice(0, 220)}`); // the toast stack is read only where a step is about toasts; the drum lane's hint word comes and goes
    const d = document.documentElement.dataset;
    const drums = document.getElementById('drums');
    return { url: location.search.slice(0, 70), outcome: d.outcome ?? null, mode: d.mode ?? null, grounded: d.grounded ?? null, runnerStarted: Number(d.x) > 1, buttons, cards, drumsShown: drums ? getComputedStyle(drums).display !== 'none' : null };
  }, keepToasts);
  steps.push({ name, ...s, ...extra });
}
const T0 = Date.now();
const step = async (name, fn) => { console.error(`[${Math.round((Date.now() - T0) / 1000)}s] ${name}`); try { const extra = await fn(); await snap(name, extra && typeof extra === 'object' ? extra : {}, /toast/i.test(name)); } catch (e) { steps.push({ name, error: String(e.message).split('\n')[0].slice(0, 120) }); } };

// 1. the first shipped course (the stock course, with the restart chip on)
await open('welcome=0&tour=0&hud=restart');
await step('first course loaded', async () => {});
await step('run right 2 s', async () => { await page.keyboard.down('ArrowRight'); await adv(2000); await page.keyboard.up('ArrowRight'); await adv(100); });
await step('R restarts', async () => { await key('KeyR'); await adv(500); });
await step('restart chip click', async () => { await page.keyboard.down('ArrowRight'); await adv(1500); await page.keyboard.up('ArrowRight'); await click('#restart-chip'); await adv(500); });
await step('Shift+R from the very start', async () => { await page.keyboard.press('Shift+KeyR'); await adv(500); });
await step('Space jump', async () => { await key('Space'); await adv(300); });
await step('H keys panel', async () => { await key('KeyH'); });
await step('H again', async () => { await key('KeyH'); });
await step('C camera 1', async () => { await key('KeyC'); await adv(300); });
await step('C camera 2', async () => { await key('KeyC'); await adv(300); });
await step('C camera 3', async () => { await key('KeyC'); await adv(300); });
await step('F front view', async () => { await key('KeyF'); });
await step('B debug view', async () => { await key('KeyB'); });
await step('B again', async () => { await key('KeyB'); });
await step('G drum lane off', async () => { await key('KeyG'); });
await step('G drum lane on', async () => { await key('KeyG'); });
await step('N ghost 1', async () => { await key('KeyN'); });
await step('N ghost 2', async () => { await key('KeyN'); });
await step('N ghost 3', async () => { await key('KeyN'); });
await step('I ideal here', async () => { await key('KeyI'); await adv(1500); });
await step('Escape', async () => { await key('Escape'); });

// toasts: three at once through the page's own hook
await open('welcome=0&tour=0&check=1');
await step('three toasts', async () => { await page.evaluate(() => { window.__say('First toast', 200); window.__say('Second toast', 200); window.__say('Third toast', 200); }); await adv(300); });
await step('toasts leave', async () => { await adv(4000); });

// a run that clears: the stored best line of lache played into the page as a friend's keys (the way scripts/report-check.mjs does)
const link = execFileSync('node_modules/.bin/tsx', ['scripts/share-link.ts', 'public/assets/demo/lache.course.json', `http://localhost:${port}`]).toString().trim();
await fresh();
await page.goto(`${link}&autoplay=1&welcome=0&tour=0`, { waitUntil: 'commit', timeout: 60000 });
await ready();
await step('challenge banner', async () => { await adv(500); });
await step('friend run ends in the report', async () => { const done = await until(() => !!document.getElementById('report-again'), 90000); await adv(800); return { reportShown: done }; });
await step('report text', async () => {
  const t = await page.evaluate(() => document.querySelector('section[aria-label="Run report"]')?.innerText ?? '');
  const has = (re) => re.test(t);
  return { report: { shareButton: has(/Copy link to challenge a friend/), download: has(/Download/), nameBox: !!(await page.$('#share-nick')), leaderboard: has(/leaderboard|Leaderboard|Best times|Top/), challengeCard: has(/friend|Beat|challenge/i), closeOrChase: has(/Close|Chase/), text: t.replace(/\s+/g, ' ').replace(/\d+(\.\d+)?/g, '#').slice(0, 400) } };
});
await step('click outside closes the report', async () => { await page.mouse.click(8, 400); await adv(800); });

// the Courses picker: open, then switch to three different shipped courses
await open('welcome=0&tour=0&course=/assets/demo/training.course.json');
await step('training loaded', async () => {});
await step('picker opens', async () => { await click('#courses-btn'); await page.waitForSelector('#world-gallery .wg-card', { timeout: 20000 }); await adv(300); return { cards: await page.$$eval('#world-gallery .wg-card', (c) => c.length >= 17), here: await page.$$eval('#world-gallery .wg-card[aria-current=true]', (c) => c.map((x) => x.dataset.value)) }; });
await step('picker Esc closes', async () => { await page.keyboard.press('Escape'); await adv(300); return { galleryGone: (await page.$('#world-gallery')) === null }; });
for (const c of ['cannon', 'band', 'drone']) {
  await step(`switch to ${c}`, async () => {
    await click('#courses-btn'); await page.waitForFunction(() => document.querySelectorAll('#world-gallery .wg-card').length >= 17, null, { timeout: 20000, polling: 100 });
    await Promise.all([page.waitForURL((u) => u.search.includes(`course=/assets/demo/${c}.course.json`), { timeout: 30000 }), page.evaluate((v) => document.querySelector(`#world-gallery .wg-card[data-value="${v}"]`).click(), `/assets/demo/${c}.course.json`)]);
    await ready();
    await adv(500);
  });
}

// the handoff to the editor and back
await open('welcome=0&tour=0&course=/assets/demo/lache.course.json');
await step('edit button is there', async () => ({ editButton: !!(await page.$('#editcourse')) }));
await step('Edit this course opens the editor', async () => {
  await page.evaluate(() => document.getElementById('editcourse').click());
  await page.waitForURL((u) => u.search.includes('mode=editor'), { timeout: 30000 });
  await page.waitForSelector('#view3d', { timeout: 120000 });
  await page.waitForFunction(() => Number(document.documentElement.dataset.pieces) >= 3, null, { timeout: 60000, polling: 200 });
  await page.waitForTimeout(1500);
  return { back: await page.evaluate(() => [...document.querySelectorAll('button,a')].filter((e) => e.offsetParent && /Back to the Course/i.test(e.innerText)).map((e) => e.id || e.tagName)), pieces: await page.evaluate(() => Number(document.documentElement.dataset.pieces)) };
});
await step('Back to the Course', async () => {
  await page.evaluate(() => [...document.querySelectorAll('button,a')].find((e) => e.offsetParent && /Back to the Course/i.test(e.innerText)).click());
  await page.waitForFunction(() => !location.search.includes('mode=editor'), null, { timeout: 30000, polling: 200 });
  await ready();
  await adv(500);
});

// last, because a page that has fallen can be busy searching
await fresh();
// a run that falls: walk off the deck into the first gap
await open('welcome=0&tour=0&course=/assets/demo/lache.course.json&startx=31');
await step('lache loaded', async () => {});
await step('run into the gap and fall', async () => { await page.keyboard.down('ArrowRight'); const fell = await until(() => document.documentElement.dataset.outcome === 'splash', 60000); await page.keyboard.up('ArrowRight'); await adv(1000); return { fell }; });
await step('fall panel R again', async () => { await key('KeyR'); await adv(500); });


await step('lache: Shift+I whole ideal', async () => { await page.keyboard.press('Shift+KeyI'); await adv(1500); });
await step('a move key takes the run back', async () => { await key('ArrowLeft'); await adv(800); });


writeFileSync(out, JSON.stringify({ errors, steps }, null, 2) + '\n');
console.log(`${steps.length} steps, ${steps.filter((s) => s.error).length} errored, ${errors.length} page errors -> ${out}`);
await browser.close();
