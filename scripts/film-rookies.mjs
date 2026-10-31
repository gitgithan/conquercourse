// Stills of the two main characters for the film's end card (CC-209): Rookie A (orange) and Rookie B (violet) standing at the Training course start line, 1280 x 720.
// Usage: PORT=5293 node scripts/film-rookies.mjs [out-dir]       (one browser at a time)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5293', outDir = process.argv[2] ?? 'films/rookies';
mkdirSync(outDir, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
let browser;
try {
  await new Promise((r) => setTimeout(r, 3000));
  browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.log('PAGEERROR ' + e.message.slice(0, 160)));
  for (const who of ['a', 'b']) {
    await page.goto(`http://localhost:${port}/?course=/assets/demo/training.course.json&rookie=${who}&welcome=0`);
    await page.waitForSelector('html[data-ready="true"]', { timeout: 120000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${outDir}/rookie-${who}.png` });
    console.log('wrote', `${outDir}/rookie-${who}.png`);
  }
} catch (e) { console.log('threw ' + String(e).slice(0, 300)); }
// always close, or node stays alive holding the browser
await browser?.close().catch(() => {});
server.kill();
process.exit(0);
