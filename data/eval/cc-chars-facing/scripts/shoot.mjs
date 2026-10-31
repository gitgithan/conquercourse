// Side-view pictures of every made character, standing (bind pose from the left) and running (the game's side camera, 1280 px), plus the run direction.
// usage (in a worktree with node_modules): node data/eval/cc-chars-facing/scripts/shoot.mjs OUT_DIR [fit=1|0]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [OUT, FIT = '1'] = process.argv.slice(2);
const cast = JSON.parse(readFileSync('public/assets/characters/cast/index.json', 'utf8')).items;
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', '5199', '--strictPort'], { stdio: 'ignore' });
mkdirSync(OUT, { recursive: true });
const tick = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
const result = {};
try {
  await new Promise((r) => setTimeout(r, 5000));
  const browser = await chromium.launch({ args: flags });
  for (const c of cast) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://localhost:5199/?demo=rookie&pose=1&nav=0&body=/assets/characters/cast/${c.file}&fit=${FIT}`);
    await page.waitForSelector('html[data-ready=true]', { timeout: 180000 });
    await page.evaluate(() => window.__rest('a', true)); await page.evaluate(tick);
    await page.screenshot({ path: join(OUT, `stand-${c.name.replace(/ /g, '-').toLowerCase()}.png`) });
    const a = await page.evaluate(() => window.__poseTick(300, 'a')); await page.evaluate(tick);
    const b = await page.evaluate(() => window.__poseTick(311, 'a')); await page.evaluate(tick);
    await page.screenshot({ path: join(OUT, `run-${c.name.replace(/ /g, '-').toLowerCase()}.png`) });
    const fit = await page.evaluate(() => window.__fit());
    result[c.name] = { runDx: b.hips.x - a.hips.x, facing: fit?.facing ?? null, errors };
    console.log(c.name, JSON.stringify(result[c.name]));
    await page.close();
  }
  await browser.close();
  writeFileSync(join(OUT, 'shoot.json'), JSON.stringify(result, null, 2));
} finally { server.kill(); }
