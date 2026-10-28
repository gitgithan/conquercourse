// The vault stage by stage on the lache demo: the bot runs at the box with the game clock slowed to 1% (the software renderer takes seconds per frame, and the game
// follows the real clock), and a picture is taken as soon as the vault reaches each stage (plant, reaching, hands down, over the top, hands off, landing).
// Output: test-results/vault-film/*.png (the caller builds a contact sheet).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const stages = (process.env.STAGES ?? '0.02,0.15,0.3,0.45,0.58,0.68,0.78,0.88,0.97').split(',').map(Number);
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: Number(process.env.W ?? 960), height: Number(process.env.H ?? 540) } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  mkdirSync('test-results/vault-film', { recursive: true });
  await page.goto(`http://localhost:${port}/?course=/assets/demo/lache.course.json&bot=ideal&startx=${process.env.STARTX ?? 14}&timescale=${process.env.TIMESCALE ?? 0.01}&debug=1`);
  await page.waitForSelector('html[data-ready=true]', { timeout: 120000 });
  await page.keyboard.press('h'); // the controls card away
  await page.evaluate(() => { const d = document.getElementById('debugpanel'); if (d) d.style.display = 'none'; }); // the debug lines stay, the text panel goes
  await page.keyboard.press('g'); // the drum strip away (it covers the step)
  await page.mouse.move(Number(process.env.W ?? 960) / 2, Number(process.env.H ?? 540) / 2);
  await page.mouse.wheel(0, Number(process.env.ZOOM ?? -500)); // zoom in on the runner
  let next = 0, last = '';
  const t0 = Date.now();
  while (next < stages.length && Date.now() - t0 < 900000) {
    const v = await page.evaluate(() => document.documentElement.dataset.vault);
    if (v !== '' && v !== undefined) {
      last = v;
      if (Number(v) >= stages[next]) { await page.screenshot({ path: `test-results/vault-film/f${String(next).padStart(2, '0')}-p${stages[next]}.png` }); console.log('shot', next, 'at', v); next++; continue; }
    } else if (last !== '' && Number(last) > 0.9) break; // the vault is over
    await page.waitForTimeout(40);
  }
  console.log({ shots: next, of: stages.length }, 'errors:', errors);
  await browser.close();
} finally { server.kill(); }
