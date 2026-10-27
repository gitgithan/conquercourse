// CC-31: contact sheets of the Rookie actor on the real simulator run, and the posed joints for the plausibility gate.
// Usage: node scripts/actor-check.mjs [a|b]  -> test-results/actor-sheet-<name>.png
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const rookie = process.argv[2] ?? 'a';
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader',
  '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const SHEETS = {
  gap: [440, 480, 492, 520, 560, 596, 602, 620, 660],
  wall: [1190, 1215, 1250, 1290, 1320, 1334, 1345, 1370, 1400],
  rope: [1640, 1700, 1722, 1750, 1790, 1800, 1850, 1960, 1990],
  tramp: [2030, 2060, 2200, 2224, 2232, 2243, 2300, 2380, 2430],
};
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', '5173', '--strictPort'], { stdio: 'ignore' });
const dir = mkdtempSync(join(tmpdir(), 'asheet-'));
mkdirSync('test-results', { recursive: true });
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 480, height: 400 } });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  page.on('console', (m) => m.type() === 'error' && console.error('console error', m.text()));
  await page.goto(`http://localhost:5173/?demo=actor&pose=1&rookie=${rookie}`);
  await page.waitForSelector('html[data-ready=true]', { timeout: 120000 });
  for (const [name, ticks] of Object.entries(SHEETS)) {
    // play the ticks in order up to each pose, so the actor's memory (easing, flight) behaves as in a run
    let n = 0;
    const want = new Set(ticks);
    for (let t = ticks[0] - 40; t <= ticks[ticks.length - 1]; t++) {
      await page.evaluate((x) => window.__showTick(x), t);
      if (want.has(t)) {
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        await page.screenshot({ path: join(dir, `${name}${n++}.png`) });
      }
    }
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '1', '-i', join(dir, `${name}%d.png`),
      '-vf', 'tile=3x3', '-frames:v', '1', `test-results/actor-sheet-${name}-${rookie}.png`]);
    console.log('sheet', name);
  }
  await browser.close();
} finally {
  rmSync(dir, { recursive: true, force: true });
  server.kill();
}
