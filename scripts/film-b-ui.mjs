// Stepped-clock capture of the real UI pages (World Slicer, World Editor, Courses, Community, Dojo, Labs) for film B.
// Same rule as film-b.mjs: one clock step plus one screenshot per output frame, nothing screen-recorded.
// Before each screenshot the page is given time to finish its work (map tiles, images): a frame is taken only when the map reports idle.
// Usage: node scripts/film-b-ui.mjs <scenario.mjs> [--out films/ui] [--port 5440]
// A scenario exports `default async ({ page, frame, frames, log, url }) => {}`; frame() steps 1/fps s and saves one picture.
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const scen = argv.find((a) => a.endsWith('.mjs')), out = opt('out', 'films/ui'), port = opt('port', '5440');
const fps = Number(opt('fps', 30)), W = 1280, H = 720, id = basename(scen, '.mjs');
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const stepped = `(() => { let t = 0; performance.now = () => t; window.__stepClock = (ms) => { t += ms; return t; }; })();`;
const dir = join(out, id); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const t0 = Date.now(), logs = []; let n = 0;
try {
  await new Promise((r) => setTimeout(r, 3500));
  const browser = await chromium.launch({ args: flags });
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror', e.message.slice(0, 200)));
  await page.addInitScript(stepped);
  const settle = async () => { // let tiles, fonts and images finish; the stepped clock does not move meanwhile
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.waitForFunction(() => { const m = window.__ccMap?.map; return !m || (m.loaded() && m.areTilesLoaded()); }, null, { timeout: 4000 }).catch(() => {});
  };
  let last = null, skipped = 0;
  // A picture is saved only when the page really changed since the last saved one: waits for data (no new picture) never become repeated frames.
  const frame = async (rate = 1, keep = false) => {
    await page.evaluate((m) => { window.__stepClock(m); return new Promise((r) => requestAnimationFrame(r)); }, (1000 / fps) * rate);
    await settle();
    const buf = await page.screenshot({ type: 'jpeg', quality: 93, timeout: 120000 });
    if (!keep && last && buf.equals(last)) { skipped++; return false; }
    last = buf; writeFileSync(join(dir, `f${String(n).padStart(5, '0')}.jpg`), buf);
    logs.push({ i: n, wall: (Date.now() - t0) / 1000 }); n++;
    if (n % 30 === 0) console.log(id, `frame ${n}`, `${((Date.now() - t0) / 1000).toFixed(0)}s (skipped ${skipped})`);
    return true;
  };
  const frames = async (k, rate = 1) => { for (let i = 0; i < k; i++) await frame(rate); };
  const log = (m) => console.log(id, m, `${((Date.now() - t0) / 1000).toFixed(0)}s`);
  const mod = await import(pathToFileURL(join(process.cwd(), scen)).href);
  await mod.default({ page, frame, frames, log, url: (q) => `http://localhost:${port}/${q}`, settle, count: () => n });
  await ctx.close(); await browser.close();
} catch (e) { console.error(id, 'FAILED', String(e).slice(0, 400)); }
server.kill();
writeFileSync(join(out, `${id}.log.json`), JSON.stringify({ id, fps, frames: n, log: logs }, null, 1));
if (n) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(dir, 'f%05d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '14', '-r', String(fps), join(out, `${id}.mp4`)]);
console.log(id, `done: ${n} frames, ${((Date.now() - t0) / 1000).toFixed(0)} s wall`);
process.exit(0);
