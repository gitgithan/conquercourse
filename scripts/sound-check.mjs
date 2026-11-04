// The ideal-run bot plays the lache demo; the page records which sounds it asked for (headless Chromium cannot be heard).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT ?? '5173';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/?course=/assets/demo/lache.course.json&bot=ideal`);
  await page.waitForSelector('#soundbutton', { timeout: 60000 });
  let done = false;
  for (let i = 0; i < Number(process.env.SECONDS ?? 120) && !done; i++) {
    await page.waitForTimeout(1000);
    done = (await page.evaluate(() => document.documentElement.dataset.outcome)) !== 'running';
  }
  const sounds = (await page.evaluate(() => document.documentElement.dataset.sounds ?? '')).split(',').filter(Boolean);
  const count = {}; for (const s of sounds) count[s] = (count[s] ?? 0) + 1;
  const button = await page.getAttribute('#soundbutton', 'aria-label');
  await page.keyboard.press('KeyM');
  const afterM = await page.getAttribute('#soundbutton', 'aria-label');
  console.log({ outcome: await page.evaluate(() => document.documentElement.dataset.outcome), count, button, afterM, errors });
  await browser.close();
} finally { server.kill(); }
