// Pictures of both first-person views at several swing angles on a bar: the corner window (?front=1) and the main camera in first person (?cam=first). Usage: node scripts/camera-shots-hang.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5473';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
try {
  await new Promise((r) => setTimeout(r, 4000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  mkdirSync('test-results/camera', { recursive: true });
  for (const [name, extra] of [['corner', 'front=1'], ['main-first', 'cam=first&front=1']]) {
    for (const th of ['0', '1.5708', '3.1416']) {
      await page.goto(`http://localhost:${port}/?course=/assets/demo/lache.course.json&hangtest=${th}&${extra}`);
      await page.waitForSelector('#frontview', { timeout: 60000 });
      await page.waitForTimeout(6000);
      await page.screenshot({ path: `test-results/camera/${name}-theta-${th}.png` });
    }
  }
  await browser.close();
} finally { server.kill(); }
