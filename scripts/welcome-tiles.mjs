// CC-246: renders the four welcome-screen pictures from small staged scenes (?demo=welcome-tile&tile=...) with the project's own Rookies.
//   PORT=5199 node scripts/welcome-tiles.mjs test-results/welcome-tiles      (then: python3 scripts/welcome-tiles-webp.py to make the .webp files)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const out = process.argv[2] ?? 'test-results/welcome-tiles';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
mkdirSync(out, { recursive: true });
let bad = 0;
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  for (const tile of ['courses', 'editor', 'slicer', 'community']) {
    const page = await browser.newPage({ viewport: { width: 400, height: 340 }, deviceScaleFactor: 2 });
    page.on('pageerror', (e) => { console.log(tile, 'ERROR', e.message); bad++; });
    await page.goto(`http://localhost:${port}/?demo=welcome-tile&tile=${tile}&backend=webgl2`);
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', null, { timeout: 90000 });
    await page.waitForTimeout(500);
    await page.evaluate(() => { for (const id of ['cc-feedback-btn', 'courses-btn', 'world-gallery', 'sitenav']) document.getElementById(id)?.remove(); }); // the page chrome is not part of the picture
    await page.screenshot({ path: `${out}/${tile}.png` });
    console.log(tile, 'ok');
    await page.close();
  }
  await browser.close();
} finally { server.kill(); }
process.exit(bad ? 1 : 0);
