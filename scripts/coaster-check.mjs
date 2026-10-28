// The coaster demos: the ideal-run bot rides "Coaster" and "a sharp hilltop" home; "first hill too low" is pushed off by hand and stalls
// (the fall panel says why). Screenshots go to test-results/coaster/.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  mkdirSync('test-results/coaster', { recursive: true });
  const result = {};
  for (const [id, mode] of [['coaster', 'bot'], ['coaster-sharp', 'bot'], ['coaster-low', 'push']]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = []; page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
    await page.goto(`http://localhost:${port}/?course=/assets/demo/${id}.course.json${mode === 'bot' ? '&bot=ideal' : ''}&debug=1`);
    await page.waitForSelector('#debugbtn', { timeout: 60000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `test-results/coaster/${id}-start.png` });
    if (mode === 'push') { await page.keyboard.down('ArrowRight'); await page.waitForTimeout(300); await page.keyboard.up('ArrowRight'); }
    let outcome = 'running', shot = 0;
    for (let i = 0; i < Number(process.env.SECONDS ?? 90) && outcome === 'running'; i++) {
      await page.waitForTimeout(1000);
      outcome = await page.evaluate(() => document.documentElement.dataset.outcome ?? 'running');
      if (i % 4 === 3 && outcome === 'running') await page.screenshot({ path: `test-results/coaster/${id}-t${shot++}.png` });
    }
    await page.waitForTimeout(800);
    await page.screenshot({ path: `test-results/coaster/${id}-end.png` });
    const text = await page.textContent('body');
    result[id] = { outcome, errors, panel: /ran out of speed|left the track|You made it/.exec(text)?.[0] ?? null };
    await page.close();
  }
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
} finally { server.kill(); }
