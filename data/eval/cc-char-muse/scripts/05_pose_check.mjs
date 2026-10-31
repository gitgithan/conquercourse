// Poses each rigged GLB in the real game viewer (?demo=rookie&pose=1&body=...) on nine ticks of the run, leap and land clips.
// Reports the worst stretch of any triangle edge against the bind pose (1 = fine, several = exploding) and writes one contact sheet per character.
// usage (in a worktree with node_modules, GLBs copied to public/assets/cc-char-trial/): node data/eval/cc-char-muse/scripts/05_pose_check.mjs OUT_DIR id [id...]
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [OUT, ...ids] = process.argv.slice(2);
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const TICKS = [300, 311, 322, 421, 440, 470, 500, 530, 600]; // run x3, leap x3, land, run, end of the loop
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', '5199', '--strictPort'], { stdio: 'ignore' });
const dir = mkdtempSync(join(tmpdir(), 'cc-char-'));
mkdirSync(OUT, { recursive: true });
const report = {};
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  for (const id of ids) {
    const page = await browser.newPage({ viewport: { width: 480, height: 480 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://localhost:5199/?demo=rookie&pose=1&nav=0&body=/assets/cc-char-trial/${id}.glb`);
    try { await page.waitForSelector('html[data-ready=true]', { timeout: 120000 }); } catch { report[id] = { loaded: false, errors }; await page.close(); continue; }
    let worst = 1, mean = 0;
    for (const [n, tick] of TICKS.entries()) {
      await page.evaluate(([t]) => window.__poseTick(t, 'a'), [tick]);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const s = await page.evaluate(() => window.__skinStretch());
      worst = Math.max(worst, s.worst); mean += s.mean / TICKS.length;
      await page.screenshot({ path: join(dir, `${id}${n}.png`) });
    }
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '1', '-i', join(dir, `${id}%d.png`), '-vf', 'tile=3x3', '-frames:v', '1', join(OUT, `sheet-${id}.png`)]);
    report[id] = { loaded: true, worstEdgeStretch: +worst.toFixed(2), meanEdgeRatio: +mean.toFixed(3), errors };
    console.log(id, JSON.stringify(report[id]));
    await page.close();
  }
  await browser.close();
} finally { server.kill(); }
writeFileSync(join(OUT, 'pose_check.json'), JSON.stringify(report, null, 2) + '\n');
