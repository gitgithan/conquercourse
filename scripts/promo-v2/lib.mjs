// Promo v2 capture library (CC-133). One browser per machine.
// Stepped clock: performance.now is ours, one step per picture, so a slow software GPU only makes capture slower, never choppier.
// Pictures are 1920x1080: the page lays out at 1280x720 (the product owner's desktop width) with a device scale of 1.5.
import { mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

export const ease = (k) => k * k * (3 - 2 * k);

export async function openSession({ url, out, pw = 'playwright', fps = 30, w = 1280, h = 720, dsf = 1.5, clock = true, gl = 'gl-egl', rafStep = false }) {
  const { chromium } = await import(pw);
  const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--use-gl=angle', `--use-angle=${gl}`, '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('pageerror', e.message.slice(0, 200)));
  if (clock) await p.addInitScript(`(() => { let t = 0; performance.now = () => t; window.__stepClock = (ms) => { t += ms; return t; }; })();`);
  // the course loop times itself on the animation-frame stamp, which would race ahead on a slow GPU: hand it the stepped clock instead
  if (clock && rafStep) await p.addInitScript(`(() => { const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = (cb) => raf(() => cb(performance.now())); })();`);
  mkdirSync(`${out}/frames`, { recursive: true });
  const S = { p, ctx, browser, out, fps, dt: 1000 / fps, n: 0, marks: {}, mx: w / 2, my: h / 2 };
  S.tick = (ms = S.dt) => p.evaluate((m) => { window.__stepClock?.(m); return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); }, ms);
  S.shot = async () => { await p.screenshot({ path: `${out}/frames/f${String(S.n++).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92, timeout: 180000 }); };
  // record sec seconds of film time; each(u) runs before every picture (u runs 0..1)
  S.rec = async (sec, each) => { const k = Math.max(1, Math.round(sec * fps)); for (let i = 0; i < k; i++) { if (each) await each(i / Math.max(1, k - 1)); await S.tick(); await S.shot(); } };
  // wait for a condition with the clock moving and no pictures (record = true takes them)
  S.until = async (fn, label, ms = 120000, record = false) => { const t0 = Date.now(); for (;;) { if (await p.evaluate(fn).catch(() => false)) return true; if (Date.now() - t0 > ms) { console.log('timeout', label); return false; } await S.tick(); if (record) await S.shot(); await p.waitForTimeout(60); } };
  S.settle = async (ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { await S.tick(); await p.waitForTimeout(40); } };
  S.mark = (k) => { S.marks[k] = +(S.n / fps).toFixed(2); console.log('mark', k, S.marks[k]); };
  S.glide = async (x1, y1, sec) => { const x0 = S.mx, y0 = S.my; await S.rec(sec, async (u) => { await p.mouse.move(x0 + (x1 - x0) * ease(u), y0 + (y1 - y0) * ease(u)); }); S.mx = x1; S.my = y1; };
  S.glideTo = async (sel, sec, opts = {}) => { const bb = await p.locator(sel).first().boundingBox(); if (!bb) throw new Error('no box ' + sel); await S.glide(bb.x + bb.width * (opts.fx ?? 0.5), bb.y + bb.height * (opts.fy ?? 0.5), sec); };
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
