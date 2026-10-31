// Plays the run, leap, land and vault clips on each made character through the game's own loader (demo-rookie and demo-captured-vault),
// with the fit on (the game) and off (as the maker wrote it). Saves a contact sheet and a front T-pose picture per character, and a verdict.
// usage (in a worktree with node_modules and the characters in public/assets/characters/cast/): node data/eval/cc-chars-eight/scripts/check_moves.mjs OUT_DIR
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [OUT] = process.argv.slice(2);
const cast = JSON.parse(readFileSync('public/assets/characters/cast/index.json', 'utf8')).items;
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const TICKS = [300, 311, 322, 421, 440, 470, 500, 530, 600]; // run x3, leap x3, land, run, end of the loop
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', '5199', '--strictPort'], { stdio: 'ignore' });
const dir = mkdtempSync(join(tmpdir(), 'cc-chars8-'));
mkdirSync(OUT, { recursive: true });
const tick = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
const report = {};
try {
  await new Promise((r) => setTimeout(r, 4000));
  const browser = await chromium.launch({ args: flags });
  for (const c of cast) {
    const out = { name: c.name, errors: [] };
    for (const fit of [1, 0]) {
      const key = fit ? 'fitted' : 'as_made';
      const page = await browser.newPage({ viewport: { width: 480, height: 480 } });
      page.on('pageerror', (e) => out.errors.push(e.message));
      const body = `/assets/characters/cast/${c.file}`;
      await page.goto(`http://localhost:5199/?demo=rookie&pose=1&nav=0&body=${body}&fit=${fit}`);
      try { await page.waitForSelector('html[data-ready=true]', { timeout: 120000 }); } catch { out[key] = { loaded: false }; await page.close(); continue; }
      await page.evaluate(() => window.__rest('a')); await page.evaluate(tick);
      await page.screenshot({ path: join(OUT, `tpose-${key}-${c.id}.png`) });
      let worst = 1, mean = 0, drift = 0;
      for (const [n, t] of TICKS.entries()) {
        const p = await page.evaluate((t) => window.__poseTick(t, 'a'), t);
        await page.evaluate(tick);
        const s = await page.evaluate(() => window.__skinStretch());
        worst = Math.max(worst, s.worst); mean += s.mean / TICKS.length;
        // the bones must follow the clip: the farthest any bone ends from where the clip put it (metres)
        p.joints.forEach((j, i) => { drift = Math.max(drift, Math.hypot(j[0] - p.target[i][0], j[1] - p.target[i][1], j[2] - p.target[i][2])); });
        if (fit) await page.screenshot({ path: join(dir, `${c.id}${n}.png`) });
      }
      const rep = await page.evaluate(() => window.__fit());
      out[key] = { loaded: true, worstEdgeStretch: +worst.toFixed(2), meanEdgeRatio: +mean.toFixed(3), boneDriftM: +drift.toFixed(3) };
      if (fit) {
        out.fitQuality = rep.quality; out.handGap = rep.handGap;
        execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '1', '-i', join(dir, `${c.id}%d.png`), '-vf', 'tile=3x3', '-frames:v', '1', join(OUT, `sheet-run-leap-land-${c.id}.png`)]);
      }
      await page.close();
    }
    // the vault clip
    const page = await browser.newPage({ viewport: { width: 480, height: 480 } });
    page.on('pageerror', (e) => out.errors.push(e.message));
    await page.goto(`http://localhost:5199/?demo=captured-vault&body=/assets/characters/cast/${c.file}`);
    try {
      await page.waitForSelector('html[data-ready=true]', { timeout: 120000 });
      const n = await page.evaluate(() => window.__vaultAt(0));
      let worst = 1;
      for (let k = 0; k < 9; k++) {
        await page.evaluate((i) => window.__vaultAt(i), Math.round(((n - 1) * k) / 8)); await page.evaluate(tick);
        worst = Math.max(worst, (await page.evaluate(() => window.__skinStretch())).worst);
        await page.screenshot({ path: join(dir, `v${c.id}${k}.png`) });
      }
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '1', '-i', join(dir, `v${c.id}%d.png`), '-vf', 'tile=3x3', '-frames:v', '1', join(OUT, `sheet-vault-${c.id}.png`)]);
      out.vault = { loaded: true, frames: n, worstEdgeStretch: +worst.toFixed(2) };
    } catch (e) { out.vault = { loaded: false, why: String(e).slice(0, 120) }; }
    await page.close();
    out.pass = !!(out.fitted?.loaded && out.vault?.loaded && out.errors.length === 0 && out.fitted.boneDriftM < 0.05 && out.fitted.worstEdgeStretch < 12);
    report[c.id] = out;
    console.log(c.id, JSON.stringify(out));
  }
  await browser.close();
} finally { server.kill(); }
writeFileSync(join(OUT, 'check_moves.json'), JSON.stringify(report, null, 2) + '\n');
