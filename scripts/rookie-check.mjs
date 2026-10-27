// CC-16 checks in the real browser: nine-pose contact sheets, posed joint export (for the plausibility gate), errors.
// Usage: node scripts/rookie-check.mjs  -> test-results/rookie-sheet-{a,b}.png, data/eval/cc-16-rookies/posed-{a,b}.json
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader',
  '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
// nine poses: three of the run, three of the leap, the landing, then the run again and the end of the loop
const PARENTS = [-1, 0, 1, 2, 3, 4, 5, 6, 6, 6, 3, 10, 11, 12, 13, 13, 3, 16, 17, 18, 19, 19, 0, 22, 23, 24, 0, 26, 27, 28];
const SHEET_TICKS = [300, 311, 322, 421, 440, 470, 500, 530, 600];
const server = spawn('npx', ['vite', '--port', '5173', '--strictPort'], { stdio: 'ignore' });
const dir = mkdtempSync(join(tmpdir(), 'sheet-'));
mkdirSync('test-results', { recursive: true });
mkdirSync('data/eval/cc-16-rookies', { recursive: true });
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 480, height: 480 } });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  page.on('console', (m) => m.type() === 'error' && console.error('console error', m.text()));
  await page.goto('http://localhost:5173/?demo=rookie&pose=1');
  await page.waitForSelector('html[data-ready=true]', { timeout: 120000 });
  const report = {};
  for (const id of ['a', 'b']) {
    for (const [n, tick] of SHEET_TICKS.entries()) {
      await page.evaluate(([t, r]) => window.__poseTick(t, r), [tick, id]);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      await page.hover('body', { position: { x: 470, y: 470 } });
      await page.screenshot({ path: join(dir, `${id}${n}.png`) });
    }
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '1', '-i', join(dir, `${id}%d.png`),
      '-vf', 'tile=3x3', '-frames:v', '1', `test-results/rookie-sheet-${id}.png`]);
    // export every 4th tick (30 fps) over one lap, in the clips' axes
    const out = await page.evaluate(async ([r, parents]) => {
            const frames = []; const worst = { aim: 0, lift: 0 }; const perBone = []; const phases = [];
      for (let t = 0; t < window.__period; t += 4) {
        const p = window.__poseTick(t, r);
        frames.push(p.joints); phases.push(p.phase);
        const dir = (js, i, par) => { const d = js[i].map((v, k) => v - js[par][k]); const n = Math.hypot(...d); return d.map((v) => v / n); };
        parents.forEach((par, i) => {
          if (par < 0) return;
          const a = dir(p.joints, i, par), b = dir(p.target, i, par);
          const deg = (Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) * 180) / Math.PI;
          perBone[i] = Math.max(perBone[i] ?? 0, deg);
          worst.aim = Math.max(worst.aim, deg);
        });
        worst.lift = Math.max(worst.lift, p.lift);
        worst.hipsErr = Math.max(worst.hipsErr ?? 0, Math.hypot(p.joints[0][2] - p.hips.x, p.joints[0][1] - p.hips.y));
      }
      return { frames, worst, phases, perBone };
    }, [id, PARENTS]);
    const names = JSON.parse(readFileSync('public/assets/motion/run.json', 'utf8')).names;
    report[id] = { worstBones: Object.fromEntries(Array.from(out.perBone, (d) => d ?? 0).map((d, i) => [names[i], +d.toFixed(0)]).filter(([, d]) => d > 25)), aimWorstDeg: +out.worst.aim.toFixed(1), hipsFromPathM: +out.worst.hipsErr.toFixed(4), floorLiftM: +out.worst.lift.toFixed(3) };
    writeFileSync(`data/eval/cc-16-rookies/posed-${id}.json`, JSON.stringify({ fps: 30, frames: out.frames }, null, 2) + '\n');
  }
  console.log(JSON.stringify(report, null, 2));
  writeFileSync('data/eval/cc-16-rookies/errors.json', JSON.stringify(report, null, 2) + '\n');
  await browser.close();
} finally {
  rmSync(dir, { recursive: true, force: true });
  server.kill();
}
