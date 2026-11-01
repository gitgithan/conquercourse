// Stepped-clock film capture for the Twitter film, version B (smoothness first).
// Every frame is one clock step plus one screenshot at the output rate; nothing is screen-recorded, blended or repeated.
// Usage: node scripts/film-b.mjs <spec.json> [--par 3] [--only id1,id2] [--out films/b]
// A spec is { port?, shots: [ { id, query, w, h, fps, frames, skip, ramp:[from,to,rate], actions:[{f, js}|{f, key, down}], wait } ] }.
//  - skip: game seconds stepped before filming, with a tiny viewport so the software GPU skips the cost (the picture is not kept).
//  - ramp: between output seconds `from` and `to` the game runs at `rate` times speed (slow motion), eased over 0.25 s each way.
//  - actions: at output frame f run `js` in the page or press/release `key`.
// Writes <out>/<id>/f00000.jpg ..., <id>.log.json (per-frame runner x,y,tick and wall seconds) and <id>.mp4.
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const specPath = argv.find((a) => !a.startsWith('--') && a.endsWith('.json'));
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const par = Number(opt('par', 2)), only = opt('only', '') ? opt('only', '').split(',') : null, outDir = opt('out', 'films/b');
const spec = JSON.parse(readFileSync(specPath, 'utf8'));
const port = String(spec.port ?? 5420);
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const stepped = `(() => { let t = 0; performance.now = () => t; window.__stepClock = (ms) => { t += ms; return t; }; })();`;
const smooth = (x) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c); };

async function runShot(browser, s) {
  const fps = s.fps ?? 30, W = s.w ?? 1280, H = s.h ?? 720, dir = join(outDir, s.id);
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const t0 = Date.now(), log = [];
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error(s.id, 'pageerror', e.message.slice(0, 200)));
  await page.addInitScript(stepped);
  await page.goto(`http://localhost:${port}/?${s.query}`);
  await page.waitForSelector('html[data-ready=true]', { timeout: 240000 });
  if (s.wait) await page.waitForSelector(s.wait, { timeout: 120000 });
  const step = (ms) => page.evaluate((m) => { window.__stepClock(m); return new Promise((r) => requestAnimationFrame(r)); }, ms);
  const two = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  if (s.skip) {
    await page.setViewportSize({ width: 160, height: 90 });
    for (let k = 0; k < Math.round(s.skip * fps); k++) await step(1000 / fps);
    await page.setViewportSize({ width: W, height: H });
    await two();
  }
  if (s.skip || s.zero) await page.evaluate(() => window.__filmZero?.());
  await page.waitForTimeout(200);
  const [rf, rt, rr] = s.ramp ?? [0, 0, 1];
  const rateAt = (sec) => 1 + (rr - 1) * smooth((sec - rf) / 0.25) * smooth((rt - sec) / 0.25);
  let prev = '', dups = 0, held = new Set();
  for (let i = 0; i < s.frames; i++) {
    for (const a of (s.actions ?? []).filter((a) => a.f === i)) {
      if (a.js) await page.evaluate(a.js);
      if (a.key) await (a.down === false ? page.keyboard.up(a.key) : page.keyboard.down(a.key));
      if (a.click) await page.click(a.click);
    }
    const file = join(dir, `f${String(i).padStart(5, '0')}.jpg`);
    let h = '';
    for (let tries = 0; tries < 5; tries++) {
      if (tries > 0) await two(); // only when the picture came out identical: the renderer was not done, wait for one more frame
      await page.screenshot({ path: file, type: 'jpeg', quality: 93, timeout: 240000 });
      h = createHash('sha1').update(readFileSync(file)).digest('hex');
      if (h !== prev || (s.static)) break;
    }
    if (h === prev) dups++;
    prev = h;
    const st = await page.evaluate(() => ({ r: window.__filmRunner ?? null, tick: document.documentElement.dataset.tick, x: document.documentElement.dataset.x }));
    log.push({ i, wall: (Date.now() - t0) / 1000, x: st.r?.x ?? Number(st.x), y: st.r?.y ?? null, tick: Number(st.tick) });
    await step((1000 / fps) * rateAt(i / fps));
    if (i % 30 === 0) console.log(s.id, `frame ${i}/${s.frames}`, `${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  await ctx.close();
  writeFileSync(join(outDir, `${s.id}.log.json`), JSON.stringify({ id: s.id, fps, dups, log }, null, 1));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(dir, 'f%05d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '14', '-r', String(fps), join(outDir, `${s.id}.mp4`)]);
  console.log(s.id, `done: ${s.frames} frames, ${dups} exact duplicates, ${((Date.now() - t0) / 1000).toFixed(0)} s wall`);
}

mkdirSync(outDir, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
try {
  await new Promise((r) => setTimeout(r, 3500));
  const browser = await chromium.launch({ args: flags });
  const queue = spec.shots.filter((s) => !only || only.includes(s.id)).filter((s) => !existsSync(join(outDir, `${s.id}.mp4`)) || only);
  const workers = Array.from({ length: par }, async () => {
    while (queue.length) { const s = queue.shift(); try { await runShot(browser, s); } catch (e) { console.error(s.id, 'FAILED', e.message.slice(0, 300)); } }
  });
  await Promise.all(workers);
  await browser.close();
} finally { server.kill(); }
