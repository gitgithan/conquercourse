// Frame rate of a course run with a custom character against the Rookie (CC-108), in the real game page.
// The game fetches /api/character?id=<id> when a character is picked; here that answer is the local file, and the pick is stored the way the page stores it (localStorage cc.character).
// usage: node data/eval/cc-char-pipeline/scripts/fps_course.mjs OUT_DIR SECONDS id=path.glb [id=path.glb ...]
// This runs on a software GPU (SwiftShader), so the numbers compare the character with the Rookie on the same machine; they are not a real graphics card's.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [OUT, SECONDS, ...pairs] = process.argv.slice(2);
const runs = [{ name: 'rookie', id: null, file: null }, ...pairs.map((p) => ({ name: p.split('=')[0], id: p.split('=')[0], file: p.split('=')[1] }))];
const port = '5197';
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
mkdirSync(OUT, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const report = { note: 'software GPU (SwiftShader) on a Vultr VM, not a real graphics card', seconds: +SECONDS, runs: {} };
try {
  await new Promise((r) => setTimeout(r, 3500));
  const browser = await chromium.launch({ args: flags });
  for (const run of runs) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)));
    if (run.file) {
      const bytes = readFileSync(run.file);
      await page.route('**/api/character?id=*', (r) => r.fulfill({ contentType: 'model/gltf-binary', body: bytes }));
      await page.route('**/api/character', (r) => r.fulfill({ contentType: 'application/json', body: '{"ok":true}' }));
      await page.addInitScript((id) => { try { localStorage.setItem('cc.character', id); } catch {} }, run.id);
    }
    await page.addInitScript(() => { window.__dt = []; let last = 0; const f = (t) => { if (last) window.__dt.push(t - last); last = t; requestAnimationFrame(f); }; requestAnimationFrame(f); });
    await page.goto(`http://localhost:${port}/?course=/assets/demo/stack.course.json&perf=1&charguard=0&hud=0`);
    await page.waitForFunction(() => { const d = document.documentElement.dataset.perf; return d && JSON.parse(d).calls > 0; }, null, { timeout: 180000 });
    await page.waitForTimeout(run.file ? 15000 : 8000); // the character loads after the first frame
    const worn = run.file ? await page.evaluate(() => !!document.querySelector('#characters-btn') && localStorage.getItem('cc.character')) : null;
    await page.evaluate(() => { window.__dt.length = 0; });
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(+SECONDS * 1000);
    await page.keyboard.up('ArrowRight');
    const dt = await page.evaluate(() => window.__dt.slice());
    const perf = JSON.parse(await page.evaluate(() => document.documentElement.dataset.perf));
    await page.screenshot({ path: join(OUT, `run-${run.name}.png`) });
    const total = dt.reduce((a, b) => a + b, 0);
    report.runs[run.name] = { frames: dt.length, fps: +(dt.length / (total / 1000)).toFixed(2), medianFrameMs: +median(dt).toFixed(1), p95FrameMs: +[...dt].sort((a, b) => a - b)[Math.floor(dt.length * 0.95)].toFixed(1), triangles: perf.triangles, calls: perf.calls, worn, errors };
    console.log(run.name, JSON.stringify(report.runs[run.name]));
    await ctx.close();
  }
  await browser.close();
} finally { server.kill(); }
writeFileSync(join(OUT, 'fps.json'), JSON.stringify(report, null, 2) + '\n');
