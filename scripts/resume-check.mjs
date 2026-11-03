// Runs a little, opens the Dojo with T, comes back with T and with the button: the run must be where it was (same tick), waiting for a key.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT ?? '5173';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/`);
  await page.waitForSelector('html[data-ready=true]', { timeout: 120000 });
  const state = () => page.evaluate(() => ({ tick: Number(document.documentElement.dataset.tick), hud: document.body.innerText.match(/(\d+) m of/)?.[1], paused: /Back from the Dojo/.test(document.body.innerText) }));
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => Number(document.documentElement.dataset.tick) > 250, null, { timeout: 120000 });
  await page.keyboard.up('ArrowRight');
  const before = await state();
  const checks = {};
  for (const way of ['T', 'button']) {
    if (way === 'T') await page.keyboard.press('KeyL'); else await page.click('text=Community courses').catch(() => {}); 
    if (way === 'button') { await page.goBack().catch(() => {}); }
    if (way === 'T') {
      await page.waitForSelector('.dojo', { timeout: 60000 });
      await page.keyboard.press('KeyL');
    }
    await page.waitForSelector('#strip', { timeout: 120000 });
    await page.waitForTimeout(1500);
    const after = await state();
    checks[`${way}: same place`] = after.hud === before.hud && Math.abs(after.tick - before.tick) <= 2;
    checks[`${way}: waits for a key`] = after.paused;
    if (way === 'T') break;
  }
  await page.keyboard.press('KeyD');
  await page.waitForTimeout(1500);
  const going = await state();
  checks['carries on after a key'] = !going.paused && going.tick > before.tick;
  // the button: back to the Dojo, then the big back button
  await page.keyboard.press('KeyL');
  await page.waitForSelector('.dojo', { timeout: 60000 });
  await page.click('#back');
  await page.waitForSelector('#strip', { timeout: 120000 });
  await page.waitForTimeout(1200);
  const viaButton = await state();
  checks['button: same run, not restarted'] = viaButton.tick >= going.tick - 2 && viaButton.paused;
  console.log(before, going, viaButton, checks, 'errors:', errors);
  await browser.close();
  process.exit(Object.values(checks).every(Boolean) && !errors.length ? 0 : 1);
} finally { server.kill(); }
