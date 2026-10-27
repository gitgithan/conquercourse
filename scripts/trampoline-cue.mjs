// Runs the ideal bot and records, in game time, how long the trampoline cue is on screen before the bounce.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT ?? '5173';
const server = spawn('npx', ['vite', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/?bot=ideal`);
  await page.waitForSelector('html[data-ready=true]', { timeout: 120000 });
  const seen = await page.evaluate(() => new Promise((res) => {
    const out = { first: null, bounce: null, text: '' };
    const iv = setInterval(() => {
      const tick = Number(document.documentElement.dataset.tick), mode = document.documentElement.dataset.mode;
      const el = [...document.querySelectorAll('div')].find((d) => /^Trampoline ahead/.test(d.textContent ?? '') && d.children.length === 0 && getComputedStyle(d).display !== 'none');
      if (el && out.first === null) { out.first = tick; out.text = el.textContent; }
      if (mode === 'bounce' && out.bounce === null) { out.bounce = tick; clearInterval(iv); res(out); }
    }, 20);
    setTimeout(() => { clearInterval(iv); res(out); }, 280000);
  }));
  // a full restart must not show the cue
  await page.waitForTimeout(500);
  await page.keyboard.press('Shift+KeyR');
  await page.waitForTimeout(1500);
  const afterRestart = await page.evaluate(() => [...document.querySelectorAll('div')].some((d) => /^(Trampoline ahead|Press Space now|Land on the trampoline)/.test(d.textContent ?? '') && d.children.length === 0 && getComputedStyle(d).display !== 'none'));
  console.log('cue showing after a full restart:', afterRestart);
  const secs = seen.first !== null && seen.bounce !== null ? (seen.bounce - seen.first) / 120 : null;
  console.log(seen, 'seconds before the bounce:', secs, 'errors:', errors);
  await browser.close();
  process.exit(secs !== null && secs >= 1.5 && !afterRestart && !errors.length ? 0 : 1);
} finally { server.kill(); }
