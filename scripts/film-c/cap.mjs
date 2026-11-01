// Version C of the Twitter film: one generic stepped-clock capture harness (nothing is a live screen recording).
// Every frame is the product of: step the page clock by exactly 1/fps, let the page draw twice, take one picture.
// Usage: node scripts/film-c/cap.mjs <shot> [--base http://localhost:5900] [--fps 30] [--w 1280] [--h 720] [--out out] [--frames N]
// A shot is defined in scripts/film-c/shots.mjs, either as a per-frame description or as a `script(rec)` that holds, moves a cursor, clicks and waits.
// The result is out/<shot>.mp4 (constant frame rate, high quality) plus out/<shot>.stats.json (the smoothness test).
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { shots } from './shots.mjs';
import { smoothness } from './smooth.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const name = process.argv[2];
const base = arg('base', 'http://localhost:5900');
const fps = Number(arg('fps', 30)), W = Number(arg('w', 1280)), H = Number(arg('h', 720));
const outDir = arg('out', 'out');
const limit = Number(arg('frames', 0));
if (!shots[name]) { console.error('unknown shot', name, Object.keys(shots).join(' ')); process.exit(2); }
const shot = shots[name];
const dir = join(outDir, `${name}.frames`);
rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });

const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const stepped = `(() => { let t = 0; performance.now = () => t; window.__stepClock = (ms) => { t += ms; return t; }; })();`;
const t0 = Date.now(); const log = (m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${name}: ${m}`);

const browser = await chromium.launch({ args: flags });
const ctxB = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const page = await ctxB.newPage();
page.setDefaultTimeout(120000);
page.on('pageerror', (e) => log('PAGEERROR ' + e.message.slice(0, 200)));
page.on('dialog', (d) => d.accept());
await page.addInitScript(stepped);
await page.addInitScript(`
  // no CSS transition or animation may run on the real clock: the film is made of the stepped clock only
  document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '*,*::before,*::after{transition:none !important;animation:none !important;scroll-behavior:auto !important}[id*=feedback]{display:none !important}.film-anim{}'; document.head.appendChild(s); });
`);

const twoFrames = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const stepMs = (ms) => page.evaluate((m) => window.__stepClock(m), ms);

const ease = (x) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c); };
const state = { cursor: null, caption: null, veil: null, frames: 0, prevHash: '', reWaits: 0, track: [], captured: true };

// the on-screen overlay layer (cursor, caption, dim veil), drawn into the page so every picture carries it
async function paintOverlay() {
  await page.evaluate((s) => {
    let root = document.getElementById('fc-root');
    if (!root) {
      root = document.createElement('div'); root.id = 'fc-root'; root.className = 'film-keep';
      root.style.cssText = 'position:fixed;inset:0;z-index:2147483000;pointer-events:none;font-family:system-ui,sans-serif';
      root.innerHTML = '<div id="fc-cur" style="position:absolute;left:0;top:0;width:28px;height:28px;display:none;transform-origin:3px 3px"><svg viewBox="0 0 24 24" width="28" height="28"><path d="M3 2l0 17 4.5-4.2 3 7 3-1.3-3-6.8 6.3 0z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg></div>'
        + '<div id="fc-cap" style="position:absolute;left:32px;bottom:34px;color:#fff;background:rgba(15,24,20,.82);font:700 34px/1.15 system-ui,sans-serif;padding:10px 20px;border-radius:12px;border-left:8px solid #ffd23f;opacity:0;letter-spacing:.2px"></div>'
        + '<div id="fc-veil" style="position:absolute;inset:0;background:#0b0f0d;opacity:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px"></div>';
      document.body.appendChild(root);
    }
    const cur = document.getElementById('fc-cur'), cap = document.getElementById('fc-cap'), veil = document.getElementById('fc-veil');
    if (s.cursor) { cur.style.display = 'block'; cur.style.transform = `translate(${s.cursor.x}px,${s.cursor.y}px) scale(${s.cursor.press ? 0.82 : 1})`; } else cur.style.display = 'none';
    if (s.caption) { if (cap.textContent !== s.caption.text) cap.textContent = s.caption.text; cap.style.opacity = String(s.caption.a); cap.style.left = (s.caption.pos === 'right' ? 'auto' : '32px'); cap.style.right = (s.caption.pos === 'right' ? '32px' : 'auto'); cap.style.top = s.caption.pos === 'top' ? '78px' : 'auto'; cap.style.bottom = s.caption.pos === 'top' ? 'auto' : '34px'; } else cap.style.opacity = '0';
    if (s.veil) { if (veil.dataset.html !== s.veil.html) { veil.innerHTML = s.veil.html; veil.dataset.html = s.veil.html; } veil.style.opacity = String(s.veil.a); veil.style.background = s.veil.bg ?? '#0b0f0d'; veil.firstChild && (veil.style.pointerEvents = 'none'); } else veil.style.opacity = '0';
  }, { cursor: state.cursor, caption: state.caption, veil: state.veil });
}

// capture one picture at the current state, then advance the clock by one frame (times `rate`, for slow motion)
async function frame(rate = 1) {
  await paintOverlay();
  await twoFrames();
  const i = state.frames;
  const file = join(dir, `f${String(i).padStart(5, '0')}.jpg`);
  let h = '';
  for (let tries = 0; tries < 4; tries++) {
    for (let tryNo = 0; ; tryNo++) {
      try { await page.screenshot({ path: file, type: 'jpeg', quality: 94, timeout: 240000 }); break; } catch (e) { if (tryNo >= 3) throw e; console.log('screenshot retry', tryNo + 1); }
    }
    h = createHash('sha1').update(readFileSync(file)).digest('hex');
    if (h !== state.prevHash || shot.staticOk) break;
    state.reWaits++; await twoFrames();
  }
  state.prevHash = h;
  if (shot.track) state.track.push(await page.evaluate(shot.track));
  state.frames++;
  if (state.frames % 30 === 0) log(`frame ${state.frames}`);
  await stepMs((1000 / fps) * rate);
}

const rec = {
  page, base, fps, W, H, log, ease, state,
  get frames() { return state.frames; },
  get time() { return state.frames / fps; },
  frame,
  // capture `sec` seconds while nothing else changes, calling each(u, t) before every picture (u from 0 to 1)
  async hold(sec, each, rate) { const n = Math.round(sec * fps); for (let k = 0; k < n; k++) { if (each) await each((k + 1) / n, k / fps); await updateCaption(); await frame(typeof rate === 'function' ? rate(k / fps) : rate ?? 1); } },
  // step the clock without taking pictures (the page runs, nothing is kept)
  async silent(sec) { // big steps (0.2 s, the game takes up to 0.25 s a draw) to get near the moment, then ordinary steps so the camera settles exactly as in a take
    let left = sec;
    while (left > 1.0) { await stepMs(200); await page.evaluate(() => new Promise((r) => requestAnimationFrame(r))); left -= 0.2; }
    const n = Math.round(Math.max(0, left) * fps); for (let k = 0; k < n; k++) { await stepMs(1000 / fps); await twoFrames(); }
  },
  // step silently, a frame at a time, until the page says yes (for things that need page time, like a flight)
  async stepUntil(fn, arg, max = 60) { for (let k = 0; k < max * fps; k++) { if (await page.evaluate(fn, arg)) return true; await stepMs(1000 / fps); await twoFrames(); } return false; },
  // wait on the real clock for async work (a fetch, a proof) without moving the page clock
  async waitReal(fn, arg, timeout = 300000) { await page.waitForFunction(fn, arg, { timeout, polling: 200 }); },
  async click(sel) { const b = await page.locator(sel).first().boundingBox(); await this.moveTo(b.x + b.width / 2, b.y + b.height / 2, 0.7); await this.press(); await page.locator(sel).first().click({ timeout: 8000 }).catch(() => page.evaluate((s) => document.querySelector(s)?.click(), sel)); },
  async press() { state.cursor.press = true; await this.hold(0.12); state.cursor.press = false; },
  // a fake cursor (the screenshots never show the real one) travels on an eased line over `sec`; the real mouse follows it so hover states are right
  async moveTo(x, y, sec = 0.8) {
    const from = state.cursor ?? { x: x - 120, y: y + 80 }; state.cursor = { ...from, press: false };
    const n = Math.max(1, Math.round(sec * fps));
    for (let k = 1; k <= n; k++) { const e = ease(k / n); state.cursor.x = from.x + (x - from.x) * e; state.cursor.y = from.y + (y - from.y) * e; await page.mouse.move(state.cursor.x, state.cursor.y); await updateCaption(); await frame(); }
  },
  async drag(x1, y1, x2, y2, sec = 1) {
    await this.moveTo(x1, y1, 0.6); await page.mouse.down(); state.cursor.press = true;
    const n = Math.round(sec * fps), x0 = state.cursor.x, y0 = state.cursor.y;
    for (let k = 1; k <= n; k++) { const e = ease(k / n); state.cursor.x = x0 + (x2 - x0) * e; state.cursor.y = y0 + (y2 - y0) * e; await page.mouse.move(state.cursor.x, state.cursor.y); await updateCaption(); await frame(); }
    await page.mouse.up(); state.cursor.press = false;
  },
  showCursor(x, y) { state.cursor = { x, y, press: false }; },
  hideCursor() { state.cursor = null; },
  // caption: text with a fade in and out (plain words, so the film reads without sound)
  caption(text, from, to, pos = 'bottom') { (state.captions ??= []).push({ text, from, to, pos }); },
  // the dim: opacity from a to b over sec, with html on top (the logo and the slogan)
  async fadeVeil(html, a, b, sec, bg) { const n = Math.max(1, Math.round(sec * fps)); for (let k = 1; k <= n; k++) { state.veil = { html, a: a + (b - a) * ease(k / n), bg }; await updateCaption(); await frame(); } },
  setVeil(html, a, bg) { state.veil = a > 0 ? { html, a, bg } : null; },
  async goto(url, readySel) { await page.goto(`${base}/${url}`); if (readySel) await page.waitForSelector(readySel, { timeout: 180000 }); },
};
async function updateCaption() {
  const t = state.frames / fps; state.caption = null;
  for (const c of state.captions ?? []) if (t >= c.from - 0.01 && t <= c.to) { state.caption = { text: c.text, pos: c.pos, a: Math.min(1, (t - c.from) / 0.25 + 0.02) * Math.min(1, (c.to - t) / 0.25 + 0.02) }; }
}

try {
  if (shot.url) await rec.goto(typeof shot.url === 'function' ? shot.url(rec) : shot.url, shot.ready);
  if (shot.setup) await shot.setup(rec);
  if (shot.skip) { await rec.silent(shot.skip); }
  if (shot.afterSkip) await shot.afterSkip(rec);
  for (const c of shot.captions ?? []) rec.caption(c.text, c.from, c.to, c.pos);
  if (shot.script) await shot.script(rec);
  else { const n = limit || Math.round(shot.seconds * fps); for (let i = 0; i < n; i++) { if (shot.frame) await shot.frame({ ...rec, i, t: i / fps }); await updateCaption(); await frame(shot.rate ? shot.rate(i / fps) : 1); } }
  log(`captured ${state.frames} frames, ${state.reWaits} re-waits`);
  const mp4 = join(outDir, `${name}.mp4`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(dir, 'f%05d.jpg'), '-c:v', 'libx264', '-preset', 'medium', '-crf', '12', '-pix_fmt', 'yuv420p', '-r', String(fps), mp4]);
  const stats = smoothness(mp4, fps, { moving: shot.moving !== false, track: state.track, cuts: shot.cuts ?? [] });
  stats.reWaits = state.reWaits;
  writeFileSync(join(outDir, `${name}.stats.json`), JSON.stringify(stats, null, 2) + '\n');
  log('stats ' + JSON.stringify(stats));
} catch (e) {
  log('FAILED ' + String(e.stack ?? e).slice(0, 600));
  process.exitCode = 1;
} finally {
  await browser.close().catch(() => {});
}
process.exit(process.exitCode ?? 0);
