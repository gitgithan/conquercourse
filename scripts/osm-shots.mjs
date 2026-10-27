// Opens each OSM course in the Course view (?course=...) and saves a PNG under data/eval/cc-46-osm-world/.
// Usage: node scripts/osm-shots.mjs place1 place2 ...
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT ?? '5188';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 200)));
  for (const place of process.argv.slice(2)) {
    await page.goto(`http://localhost:${port}/?course=/assets/experiments/osm/${place}.course.json&bot=ideal&timescale=0.3`);
    await page.waitForSelector('html[data-ready=true]', { timeout: 120000 });
    await page.waitForTimeout(6000);
    await page.screenshot({ path: `data/eval/cc-46-osm-world/${place}.png` });
    console.log(place, await page.textContent('body').then((t) => t.match(/of [\d.]+ m/)?.[0]));
    console.log('saved', place);
  }
  await browser.close();
} finally { server.kill(); }
