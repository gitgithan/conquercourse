// True-speed film: a stepped clock replaces performance.now, one frame per screenshot, ffmpeg encodes at the game's rate.
// Usage: node scripts/film.mjs [--query "demo=rookie"] [--frames 90] [--fps 30] [--out test-results/film.mp4] [--width 960] [--height 540]
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const query = arg('query', '');
const frames = Number(arg('frames', 90));
const fps = Number(arg('fps', 30));
const out = arg('out', 'test-results/film.mp4');
const width = Number(arg('width', 960));
const height = Number(arg('height', 540));
const port = arg('port', '5173');

const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader',
  '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const stepped = `(() => {
  let t = 0;
  performance.now = () => t;
  window.__stepClock = (ms) => { t += ms; return t; };
})();`;

const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const dir = mkdtempSync(join(tmpdir(), 'film-'));
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.addInitScript(stepped);
  await page.goto(`http://localhost:${port}/?${query}`);
  await page.waitForSelector('html[data-ready=true]', { timeout: 120000 });
  const twoFrames = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  for (let i = 0; i < frames; i++) {
    await twoFrames();
    await page.screenshot({ path: join(dir, `f${String(i).padStart(5, '0')}.png`) });
    await page.evaluate((ms) => window.__stepClock(ms), 1000 / fps);
  }
  await browser.close();
  mkdirSync(join(out, '..'), { recursive: true });
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(dir, 'f%05d.png'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-movflags', '+faststart', out]);
  console.log(`wrote ${out}: ${frames} frames, ${(frames / fps).toFixed(2)} s of game time`);
} finally {
  rmSync(dir, { recursive: true, force: true });
  server.kill();
}
