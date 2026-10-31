// Stepped-clock capture helpers for the Twitter film, version A (any page, not only the Course).
// Rules: the page clock (performance.now) only moves when the script moves it, one step per picture; every picture is taken at the film's frame rate;
// nothing is recorded live, so a slow software GPU makes the capture slower and never choppier.
// A shot script opens a Shot, calls frames(n, perFrame) for the seconds that are kept and advance(ms) for waits that are not, then close().
import { chromium } from 'playwright';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

export const FLAGS = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];

const STEPPED = `(() => {
  let t = 0, queue = [], id = 0;
  performance.now = () => t;
  window.__realRaf = window.requestAnimationFrame.bind(window);
  // the page's animation frames run only when the script says so: one call of __tick() runs every callback asked for before it, once, with the stepped time.
  // That makes the number of game and map frames per picture exactly the script's choice (a camera that eases a little each frame cannot jitter).
  window.requestAnimationFrame = (cb) => { queue.push([++id, cb]); return id; };
  window.cancelAnimationFrame = (i) => { queue = queue.filter((q) => q[0] !== i); };
  window.__stepClock = (ms) => { t += ms; return t; };
  window.__tick = () => { const q = queue; queue = []; for (const [, cb] of q) { try { cb(t); } catch (e) { console.error(e); } } return q.length; };
  // a drawn pointer, because a screenshot never contains the mouse; it follows the real mouse events the script sends
  const addCursor = () => {
    if (document.getElementById('film-cursor') || !document.body) return;
    const c = document.createElement('div');
    c.id = 'film-cursor';
    c.style.cssText = 'position:fixed;left:-50px;top:-50px;width:22px;height:22px;z-index:2147483647;pointer-events:none;background:url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%2722%27 height=%2722%27 viewBox=%270 0 22 22%27><path d=%27M2 1 L2 17 L6.5 13 L9.5 20 L12.5 18.8 L9.6 12 L15.5 12 Z%27 fill=%27white%27 stroke=%27black%27 stroke-width=%271.4%27 stroke-linejoin=%27round%27/></svg>") no-repeat;filter:drop-shadow(0 1px 2px rgba(0,0,0,.45))';
    document.body.appendChild(c);
  };
  addEventListener('mousemove', (e) => { addCursor(); const c = document.getElementById('film-cursor'); if (c) { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; } }, true);
})();`;

export class Shot {
  constructor({ name, outDir, fps = 30, width = 1280, height = 720, quality = 92 }) {
    this.name = name; this.fps = fps; this.width = width; this.height = height; this.quality = quality;
    this.dir = join(outDir, name); rmSync(this.dir, { recursive: true, force: true }); mkdirSync(this.dir, { recursive: true });
    this.n = 0; this.prev = ''; this.dups = 0; this.rewaits = 0; this.marks = []; this.hashes = [];
    this.t0 = Date.now();
  }
  log(m) { console.log(`[${this.name} ${((Date.now() - this.t0) / 1000).toFixed(0)}s]`, m); }
  mark(label) { this.marks.push({ label, frame: this.n }); this.log(`mark ${label} @frame ${this.n}`); }
  async open(url, { cursor = true, noTransitions = true, waitReady = null } = {}) {
    this.browser = await chromium.launch({ args: FLAGS });
    this.ctx = await this.browser.newContext({ viewport: { width: this.width, height: this.height }, deviceScaleFactor: 1 });
    await this.ctx.addInitScript(STEPPED);
    if (noTransitions) await this.ctx.addInitScript(`document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '*,*::before,*::after{transition:none !important;animation-delay:0s !important}'; document.head.appendChild(s); });`);
    this.page = await this.ctx.newPage();
    this.page.setDefaultTimeout(30000);
    this.page.on('pageerror', (e) => this.log('PAGEERROR ' + e.message.slice(0, 160)));
    await this.page.goto(url, { timeout: 240000 });
    if (waitReady) await waitReady(this.page);
    this.stepMs = 1000 / this.fps;
    return this.page;
  }
  // let the browser draw what the page just painted (the page's own animation frames are stopped, so the real ones are used here)
  twoFrames() { return this.page.evaluate(() => new Promise((r) => window.__realRaf(() => window.__realRaf(r)))); }
  // one clock step of `ms`, played as `sub` animation frames (2 at 30 pictures a second = the game's 60 frames a second)
  async step(ms) {
    await this.page.evaluate(([s, k]) => { for (let i = 0; i < k; i++) { window.__stepClock(s / k); window.__tick(); } }, [ms, this.sub ?? 2]);
  }
  // move the clock without taking pictures (a wait that is not kept); `ms` is covered in steps of at most `chunk` ms so time-based animations stay on their path
  async advance(ms, chunk = 1000 / 30) {
    for (let left = ms; left > 0; left -= chunk) await this.step(Math.min(chunk, left));
    await this.twoFrames();
  }
  // take one picture of the page as it is now (the clock has been stepped by the caller)
  async grab({ expectMotion = true } = {}) {
    const file = join(this.dir, `f${String(this.n).padStart(5, '0')}.jpg`);
    let h = '';
    for (let tries = 0; tries < 4; tries++) {
      await this.twoFrames();
      const buf = await this.page.screenshot({ type: 'jpeg', quality: this.quality, timeout: 180000 });
      h = createHash('sha1').update(buf).digest('hex');
      if (h !== this.prev || !expectMotion) { writeFileSync(file, buf); break; }
      this.rewaits++;
      if (tries === 3) writeFileSync(file, buf);
    }
    if (h === this.prev) this.dups++;
    this.prev = h; this.hashes.push(h.slice(0, 10)); this.n++;
    if (this.n % 15 === 0) this.log(`frame ${this.n}, ${((Date.now() - this.t0) / 1000).toFixed(0)} s since start`);
  }
  // n kept frames: for each, run perFrame(i, n) (mouse moves, camera calls), step the clock one frame, take the picture
  async frames(n, perFrame = null, { expectMotion = true } = {}) {
    for (let i = 0; i < n; i++) {
      if (perFrame) await perFrame(i, n);
      await this.step(this.stepMs * (this.rate ?? 1));
      await this.grab({ expectMotion });
    }
  }
  async mouseTo(x, y, n, from = null) { // a pointer glide over n kept frames (smoothstep), the pointer starts at `from` (or where the last glide ended)
    const a = from ?? this.pointer ?? [x, y], ease = (u) => u * u * (3 - 2 * u);
    await this.frames(n, async (i) => { const u = ease((i + 1) / n); await this.page.mouse.move(a[0] + (x - a[0]) * u, a[1] + (y - a[1]) * u); });
    this.pointer = [x, y];
  }
  async close() {
    await this.ctx?.close().catch(() => {});
    await this.browser?.close().catch(() => {});
    writeFileSync(join(this.dir, 'shot.json'), JSON.stringify({ name: this.name, fps: this.fps, width: this.width, height: this.height, frames: this.n, dups: this.dups, rewaits: this.rewaits, marks: this.marks }, null, 2) + '\n');
    this.log(`done: ${this.n} frames, ${this.dups} exact duplicates, ${this.rewaits} re-waits`);
  }
}

export const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
