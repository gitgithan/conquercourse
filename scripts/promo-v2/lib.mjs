// Promo v2 capture library (CC-133). One browser per machine.
// Stepped clock: performance.now is ours, one step per picture, so a slow software GPU only makes capture slower, never choppier.
// Pictures are 1920x1080: the page lays out at 1280x720 (the product owner's desktop width) with a device scale of 1.5.
import { mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// CC-133 click marker (owner rule, 2026-11-05): a headless browser draws no cursor, so the page draws one, and every press shows a big yellow circle over it.
// It is an in-page layer (so it is in every captured picture) timed on the stepped clock, so it looks the same on a slow machine.
// It survives a page change (the position is kept in sessionStorage).
export const CLICK_MARKER = `(() => {
  const SIZE = 84, KEY = 'cc.mk';
  let x = -200, y = -200, down = null, up = null, root, ring, arrow;
  try { const k = JSON.parse(sessionStorage.getItem(KEY) || 'null'); if (k) { x = k.x; y = k.y; } } catch {}
  const build = () => {
    if (root || !document.documentElement) return;
    root = document.createElement('div'); root.id = 'cc-click-marker'; root.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;z-index:2147483647;pointer-events:none';
    ring = document.createElement('div'); ring.style.cssText = 'position:absolute;width:' + SIZE + 'px;height:' + SIZE + 'px;margin:-' + SIZE / 2 + 'px 0 0 -' + SIZE / 2 + 'px;border-radius:50%;box-sizing:border-box;border:7px solid #ffd400;background:rgba(255,212,0,.38);box-shadow:0 0 0 2px rgba(0,0,0,.35);opacity:0';
    arrow = document.createElement('div'); arrow.style.cssText = 'position:absolute;width:26px;height:34px;margin:0';
    arrow.innerHTML = '<svg width="26" height="34" viewBox="0 0 26 34"><path d="M2 2 L2 27 L8.5 21 L13 31 L18 29 L13.5 19.5 L22 19.5 Z" fill="#fff" stroke="#111" stroke-width="2" stroke-linejoin="round"/></svg>';
    root.append(ring, arrow); document.documentElement.append(root); paint();
  };
  const paint = () => {
    if (!root) return;
    const now = performance.now(); let o = 0, sc = 1;
    if (down !== null && (up === null || up < down)) { const a = now - down; sc = a < 160 ? 1.7 - 0.7 * (a / 160) : 1 + 0.06 * Math.sin((a - 160) / 120); o = 1; }   // pressed: pops in, then pulses gently while held
    else if (up !== null && down !== null) { const u = Math.min(1, (now - up) / 600); sc = 1 + 0.5 * u; o = 1 - u; if (now - up < 280) o = 1; }                 // let go: stays 0.28 s, then grows and fades
    ring.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + sc + ')'; ring.style.opacity = String(o);
    arrow.style.transform = 'translate(' + x + 'px,' + y + 'px)'; arrow.style.display = x < 0 ? 'none' : 'block';
  };
  const loop = () => { paint(); requestAnimationFrame(loop); };
  const move = (e) => { x = e.clientX; y = e.clientY; try { sessionStorage.setItem(KEY, JSON.stringify({ x, y })); } catch {} paint(); };
  addEventListener('mousemove', move, true);
  addEventListener('mousedown', (e) => { move(e); down = performance.now(); up = null; build(); paint(); }, true);
  addEventListener('mouseup', (e) => { move(e); up = performance.now(); paint(); }, true);
  window.__ccMarker = { fire: () => { down = performance.now(); up = down + 1; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { build(); loop(); }); else { build(); loop(); }
})();`;

export const ease = (k) => k * k * (3 - 2 * k);

export async function openSession({ url, out, pw = 'playwright', fps = 30, w = 1280, h = 720, dsf = 1.5, clock = true, gl = 'gl-egl', rafStep = false, marker = true }) {
  const { chromium } = await import(pw);
  const browser = await chromium.launch({ args: ["--ignore-gpu-blocklist", "--use-gl=angle", `--use-angle=${process.env.CC_GL || gl}`, '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('pageerror', e.message.slice(0, 200)));
  if (clock) await p.addInitScript(`(() => { let t = 0; performance.now = () => t; window.__stepClock = (ms) => { t += ms; return t; }; })();`);
  // the course loop times itself on the animation-frame stamp, which would race ahead on a slow GPU: hand it the stepped clock instead
  if (clock && rafStep) await p.addInitScript(`(() => { const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = (cb) => raf(() => cb(performance.now())); })();`);
  if (marker) await p.addInitScript(CLICK_MARKER);
  mkdirSync(`${out}/frames`, { recursive: true });
  const S = { p, ctx, browser, out, fps, dt: 1000 / fps, n: 0, marks: {}, mx: w / 2, my: h / 2 };
  S.tick = (ms = S.dt) => p.evaluate((m) => { window.__stepClock?.(m); return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); }, ms);
  S.shot = async () => { await p.screenshot({ path: `${out}/frames/f${String(S.n++).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92, timeout: 180000 }); };
  // record sec seconds of film time; each(u) runs before every picture (u runs 0..1)
  S.rec = async (sec, each) => { const k = Math.max(1, Math.round(sec * fps)); for (let i = 0; i < k; i++) { if (each) await each(i / Math.max(1, k - 1)); await S.tick(); await S.shot(); } };
  // wait for a condition with the clock moving and no pictures (record = true takes them)
  S.until = async (fn, label, ms = 120000, record = false) => { const t0 = Date.now(); for (;;) { if (await p.evaluate(fn).catch(() => false)) return true; if (Date.now() - t0 > ms) { console.log('timeout', label); return false; } await S.tick().catch(() => {}); if (record) await S.shot(); await p.waitForTimeout(60); } };
  S.settle = async (ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { await S.tick().catch(() => {}); await p.waitForTimeout(40); } };
  S.mark = (k) => { S.marks[k] = +(S.n / fps).toFixed(2); console.log('mark', k, S.marks[k]); };
  S.glide = async (x1, y1, sec) => { const x0 = S.mx, y0 = S.my; await S.rec(sec, async (u) => { await p.mouse.move(x0 + (x1 - x0) * ease(u), y0 + (y1 - y0) * ease(u)); }); S.mx = x1; S.my = y1; };
  S.glideTo = async (sel, sec, opts = {}) => { const bb = await p.locator(sel).first().boundingBox(); if (!bb) throw new Error('no box ' + sel); await S.glide(bb.x + bb.width * (opts.fx ?? 0.5), bb.y + bb.height * (opts.fy ?? 0.5), sec); };
  // a real press with the yellow circle: move there, press, hold `hold` s (the circle pops in), let go (the click happens), keep filming `after` s
  S.pressAt = async (x, y, { hold = 0.35, after = 0.45, move = 0.7 } = {}) => { if (move > 0) await S.glide(x, y, move); await p.mouse.down(); await S.rec(hold); await p.mouse.up(); if (after > 0) await S.rec(after); };
  S.clickSel = async (sel, o = {}) => { const bb = await p.locator(sel).first().boundingBox(); if (!bb) throw new Error('no box ' + sel); await S.pressAt(bb.x + bb.width * (o.fx ?? 0.5), bb.y + bb.height * (o.fy ?? 0.5), o); };
  S.drag = async (dx, dy, sec, button = 'left') => { const x0 = S.mx, y0 = S.my; await p.mouse.down({ button }); await S.rec(sec, async (u) => { await p.mouse.move(x0 + dx * ease(u), y0 + dy * ease(u)); }); await p.mouse.up({ button }); S.mx = x0 + dx; S.my = y0 + dy; };
  // ease a scroll position of an element (css selector) from its current value to `to`
  S.scrollTo = async (sel, to, sec) => { const from = await p.evaluate((s) => document.querySelector(s).scrollTop, sel); await S.rec(sec, (u) => p.evaluate(([s, f, t, k]) => { document.querySelector(s).scrollTop = f + (t - f) * k; }, [sel, from, to, ease(u)])); };
  // ease a range input to a value (fires input events like a hand)
  S.slide = async (sel, to, sec) => { const from = await p.evaluate((s) => Number(document.querySelector(s).value), sel); await S.rec(sec, (u) => p.evaluate(([s, f, t, k]) => { const e = document.querySelector(s); e.value = String(f + (t - f) * k); e.dispatchEvent(new Event('input', { bubbles: true })); }, [sel, from, to, ease(u)])); };
  S.hideChrome = () => p.addStyleTag({ content: '#cc-feedback-btn{display:none!important}' }).then(() => p.evaluate(() => document.querySelectorAll('button').forEach((x) => { if (/^(Feedback|Sound)/.test(x.textContent.trim())) x.style.display = 'none'; })));
  S.finish = async (extra = {}) => { writeFileSync(`${out}/marks.json`, JSON.stringify({ fps, frames: S.n, seconds: +(S.n / fps).toFixed(2), marks: S.marks, ...extra }, null, 2)); await browser.close(); console.log('frames', S.n); };
  if (url) await p.goto(url);
  return S;
}

// frames -> mp4 (+ thumbnail) at the real 30 fps
export function encode(dir, outMp4, fps = 30) {
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', `${dir}/frames/f%05d.jpg`, '-vf', 'scale=1920:1080:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-crf', '15', '-preset', 'medium', outMp4], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ffmpeg failed');
}

// frames -> a retimed clip: game seconds [from, to] played k times faster. Frames are averaged k at a time first, so a fast move blurs a little and never steps.
export function retime(dir, outMp4, { k = 1, from = 0, to = null, fps = 30 } = {}) {
  const n = Math.max(1, Math.ceil(k)), vf = [];
  if (k > 1.001) vf.push(`tmix=frames=${n}`, `setpts=PTS/${k}`, `fps=${fps}`);
  vf.push('scale=1920:1080:flags=lanczos', 'format=yuv420p');
  const args = ['-y', '-loglevel', 'error', '-framerate', String(fps), '-start_number', String(Math.round(from * fps))];
  args.push('-i', `${dir}/frames/f%05d.jpg`);
  if (to !== null) args.push('-frames:v', String(Math.round((to - from) * fps)));
  args.push('-vf', vf.join(','), '-c:v', 'libx264', '-crf', '15', '-preset', 'medium', outMp4);
  const r = spawnSync('ffmpeg', args, { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ffmpeg failed');
  spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', outMp4, '-vf', 'select=eq(n\\,45)', '-frames:v', '1', outMp4.replace(/clip\.mp4$/, 'thumb.jpg')], { stdio: 'inherit' });
}
