// In-game picture polish stills (CC-188): the same film-camera moment with and without ?fx=. Stills only.
// Usage: node scripts/fx-stills.mjs <out_dir>   (run on a VM; one browser at a time)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] ?? 'data/eval/cc-spectacle/outputs';
mkdirSync(out, { recursive: true });
const course = 'course=/assets/demo/training.course.json';
const shots = [
  { name: 'a-flyover', q: `${course}&film=flyover`, ms: 5000, fx: ['none', 'bloom', 'vignette', 'dof', 'all'] },
  { name: 'b-orbit-rope', q: `${course}&film=orbit&filmx=189&filmy=8`, ms: 4000, fx: ['none', 'all'] },
  { name: 'c-push-wall', q: `${course}&film=push&filmx=88&filmy=2`, ms: 3500, fx: ['none', 'all'] },
];
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', '5188', '--strictPort'], { stdio: 'ignore' });
const log = [];
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  for (const s of shots) for (const fx of s.fx) {
    const t0 = Date.now();
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', (e) => console.error('pageerror', e.message));
    await page.addInitScript('(() => { let t = 0; performance.now = () => t; window.__stepClock = (ms) => { t += ms; return t; }; })();');
    await page.goto(`http://localhost:5188/?${s.q}${fx === 'none' ? '' : `&fx=${fx}`}`);
    await page.waitForSelector('html[data-ready=true]', { timeout: 180000 });
    for (let k = 0; k < 4; k++) await page.evaluate((ms) => { window.__stepClock(ms); return new Promise((r) => requestAnimationFrame(r)); }, s.ms / 4);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await new Promise((r) => setTimeout(r, 1500));
    const file = `${s.name}-${fx}.png`;
    await page.screenshot({ path: join(out, file), timeout: 180000 });
    log.push({ file, seconds: (Date.now() - t0) / 1000 });
    await page.close();
  }
  await browser.close();
  writeFileSync(join(out, 'fx-info.json'), JSON.stringify(log, null, 2) + '\n');
} finally { server.kill(); }
