// Characterization of the Course camera, the film hooks, the clip maker and the character loader (CC-133). A refactor safety net, not a pass/fail check:
// run it before and after a move and diff the two files (node scripts/course-camera-characterize.mjs out.json; the golden is tests/golden/camera-characterize.json).
// The page clock is stepped by the script (the films' trick), so the game runs the same ticks every time. The page is opened with ?camprobe=1, which adds window.__probe().
// It records the camera (position, direction, up, field of view) rounded to 3 places, the camera mode and orbit, which body is visible, and the clip's numbers (not its bytes).
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const out = process.argv[2] ?? 'test-results/camera-characterize.json';
const port = process.env.PORT ?? '5173';
const base = `http://localhost:${port}/`;
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
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
async function fresh() { const old = page; page = await ctx.newPage(); page.setDefaultTimeout(30000); page.on('pageerror', (e) => errors.push(e.message.slice(0, 160))); if (old) old.close({ runBeforeUnload: false }).catch(() => {}); }
await fresh();
const steps = [];
const adv = (ms, step = 100) => page.evaluate(([m, s]) => window.__adv(m, s), [ms, step]);
async function until(test, maxMs = 30000) {
  for (let t = 0; t <= maxMs; t += 500) { if (await page.evaluate(test)) return true; await adv(500); await page.waitForTimeout(20); }
  return false;
}
async function ready() {
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', null, { timeout: 240000, polling: 200 });
  for (let i = 0; i < 400; i++) { await adv(100); if (await page.evaluate(() => document.documentElement.dataset.tick !== undefined)) break; await page.waitForTimeout(150); }
  await adv(1000);
}
async function open(query) { await fresh(); await page.goto(`${base}?camprobe=1&${query}`, { waitUntil: 'load', timeout: 240000 }); await ready(); }
const key = async (code, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(code); await adv(100); } };
const r3 = (v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 + 0 : Array.isArray(v) ? v.map(r3) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, r3(x)])) : v);
const probe = async () => r3(await page.evaluate(() => window.__probe()));
const T0 = Date.now();
async function step(name, fn) {
  console.error(`[${Math.round((Date.now() - T0) / 1000)}s] ${name}`);
  try { const extra = (await fn()) ?? {}; steps.push({ name, probe: await probe().catch(() => null), ...extra }); } catch (e) { steps.push({ name, error: String(e.message).split('\n')[0].slice(0, 120) }); }
}
const run = async (ms) => { await page.keyboard.down('ArrowRight'); await adv(ms); await page.keyboard.up('ArrowRight'); };

// 1. the stock course: the three views, the mouse, the front inset
await open('welcome=0&tour=0');
await step('start', async () => {});
await step('run 3 s', async () => { await run(3000); await adv(500); });
await step('jump in the air', async () => { await key('Space'); await adv(250); });
await step('landed', async () => { await adv(1500); });
for (const n of [1, 2, 3, 4]) {
  await step(`C ${n}, at once`, async () => { await key('KeyC'); });
  await step(`C ${n}, settled`, async () => { await adv(1500); });
}
await step('drag to turn', async () => { await page.mouse.move(640, 360); await page.mouse.down(); await page.mouse.move(540, 320, { steps: 4 }); await page.mouse.up(); await adv(1500); });
await step('wheel in (zoom)', async () => { await page.mouse.move(640, 360); await page.mouse.wheel(0, -400); await adv(1500); });
await step('wheel in to the face', async () => { await page.mouse.wheel(0, -1500); await adv(2500); });
await step('double click resets', async () => { await page.mouse.dblclick(640, 360); await adv(1500); });
await step('wheel out', async () => { await page.mouse.wheel(0, 600); await adv(1500); });
await step('C to 45 degrees, drag', async () => { await key('KeyC'); await page.mouse.move(640, 360); await page.mouse.down(); await page.mouse.move(700, 400, { steps: 4 }); await page.mouse.up(); await adv(1500); });
await step('C to first person, drag', async () => { await key('KeyC'); await page.mouse.move(640, 360); await page.mouse.down(); await page.mouse.move(600, 330, { steps: 4 }); await page.mouse.up(); await adv(1500); });
await step('F front inset off', async () => { await key('KeyF'); await adv(300); });
await step('F front inset on', async () => { await key('KeyF'); await adv(300); });
await step('R restart', async () => { await key('KeyR'); await adv(1500); });
await step('resize to 1000 wide', async () => { await page.setViewportSize({ width: 1000, height: 640 }); await adv(500); });

// 2. ?cam=first at the start, on a course with bars (the head turns about the bar)
await open('welcome=0&tour=0&cam=first&course=/assets/demo/lache.course.json');
await step('lache, first person at the start', async () => {});
const link = execFileSync('node_modules/.bin/tsx', ['scripts/share-link.ts', 'public/assets/demo/lache.course.json', `http://localhost:${port}`]).toString().trim();
for (const cam of ['first', 'side', 'angle']) {
  await fresh();
  await page.goto(`${link}&autoplay=1&welcome=0&tour=0&camprobe=1&cam=${cam}`, { waitUntil: 'commit', timeout: 60000 });
  await ready();
  for (let i = 1; i <= 8; i++) await step(`friend run, ${cam}, ${i * 2} s`, async () => { await adv(2000); });
}

// 3. the film camera: a few shots on the stepped clock
for (const shot of ['orbit', 'follow', 'eyes', 'hero', 'clean']) {
  await open(`welcome=0&tour=0&film=${shot}`);
  for (let i = 1; i <= 4; i++) await step(`film ${shot}, ${i} s`, async () => { await adv(1000); return { filmRunner: await page.evaluate(() => { const f = window.__filmRunner; return f ? { x: Math.round(f.x * 1000) / 1000, y: Math.round(f.y * 1000) / 1000 } : null; }) }; });
}

// 4. the clip maker: a friend's run turned into a clip; the clip's own camera sets how big the runner is and how many metres the picture spans
await fresh();
await page.goto(`${link}&clip=auto&welcome=0&tour=0&camprobe=1`, { waitUntil: 'commit', timeout: 60000 });
await ready();
await step('clip started', async () => { await adv(300); });
await step('clip made', async () => {
  const done = await until(() => !!document.documentElement.dataset.clip, 240000);
  const d = await page.evaluate(() => ({ made: Number(document.documentElement.dataset.clip) > 0, runner: document.documentElement.dataset.clipRunner ?? null, metres: document.documentElement.dataset.clipMetres ?? null, blob: !!window.__clip }));
  return { done, clip: d };
});
await step('after the clip', async () => { await adv(1000); });

// 5. the character loader: the Rookie buttons, a made-up character address, the saved choice
await open('welcome=0&tour=0');
const pickState = () => page.evaluate(() => ({ pressed: [...document.querySelectorAll('#pickrunner button')].map((b) => `${b.id || b.title || 'button'}|${b.getAttribute('aria-pressed')}`), note: document.getElementById('charnote')?.textContent ?? null, noteShown: document.getElementById('charnote') ? getComputedStyle(document.getElementById('charnote')).display !== 'none' : null, saved: (() => { try { return localStorage.getItem('cc.rookie'); } catch { return null; } })() }));
await step('character buttons at the start', async () => ({ pick: await pickState() }));
await step('female Rookie', async () => { await page.evaluate(() => document.querySelectorAll('#pickrunner button')[1].click()); await adv(3000); return { pick: await pickState() }; });
await step('male Rookie', async () => { await page.evaluate(() => document.querySelectorAll('#pickrunner button')[0].click()); await adv(3000); return { pick: await pickState() }; });
await open('welcome=0&tour=0&rookie=b&nosave=1');
await step('?rookie=b', async () => { await adv(2000); return { pick: await pickState() }; });
await open('welcome=0&tour=0&char=0123456789abcdef&nosave=1');
await step('?char= with an unknown address', async () => { await adv(4000); return { pick: await pickState() }; });
await open('welcome=0&tour=0&look=custom');
await step('?look=custom', async () => { await adv(3000); return { pick: await pickState() }; });

writeFileSync(out, JSON.stringify({ errors, steps }, null, 2) + '\n');
console.log(`${steps.length} steps, ${steps.filter((s) => s.error).length} errored, ${errors.length} page errors -> ${out}`);
await browser.close();
