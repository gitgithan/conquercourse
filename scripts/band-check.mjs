// The Band demo in the browser: the ideal-run bot stretches the band, turns round and clears the gap; by hand, ← stretches the band and the hint says so.
// Screenshots go to test-results/band/.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  mkdirSync('test-results/band', { recursive: true });
  const result = {};
  // 1) the bot
  if (process.env.ONLY !== "hand") {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = []; page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
    await page.goto(`http://localhost:${port}/?course=/assets/demo/band.course.json&bot=ideal&debug=1`);
    await page.waitForSelector('#debugbtn', { timeout: 60000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/band/bot-start.png' });
    let outcome = 'running', shot = 0, minX = 0, hint = '';
    for (let i = 0; i < Number(process.env.SECONDS ?? 240) && outcome === 'running'; i++) {
      await page.waitForTimeout(1000);
      const s = await page.evaluate(() => ({ o: document.documentElement.dataset.outcome ?? 'running', x: Number(document.documentElement.dataset.x ?? 0), h: (document.body.innerText.match(/(Hold ← to run away[^\n]*|Stretched[^\n]*|TURN NOW[^\n]*)/) ?? [''])[0] }));
      outcome = s.o; minX = Math.min(minX, s.x); if (s.h) hint = s.h;
      if (i % 6 === 5 && outcome === 'running') await page.screenshot({ path: `test-results/band/bot-t${shot++}.png` });
    }
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'test-results/band/bot-end.png' });
    result.bot = { outcome, farthestBack: minX, lastHint: hint.slice(0, 120), errors };
    await page.close();
  }
  // 2) by hand: hold ← and read the hint
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = []; page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
    await page.goto(`http://localhost:${port}/?course=/assets/demo/band.course.json&debug=1`);
    await page.waitForSelector('#debugbtn', { timeout: 60000 });
    await page.waitForTimeout(1500);
    const first = await page.evaluate(() => (document.body.innerText.match(/(Hold ← to run away[^\n]*|Stretched[^\n]*|TURN NOW[^\n]*)/) ?? [''])[0]);
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(9000);
    const hint = await page.evaluate(() => (document.body.innerText.match(/(Hold ← to run away[^\n]*|Stretched[^\n]*|TURN NOW[^\n]*)/) ?? [''])[0]);
    const x = await page.evaluate(() => Number(document.documentElement.dataset.x ?? 0));
    await page.screenshot({ path: 'test-results/band/hand-stretched.png' });
    await page.keyboard.up('ArrowLeft');
    result.hand = { firstHint: first.slice(0, 110), hintWhileStretched: hint.slice(0, 160), x, errors };
    await page.close();
  }
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
} finally { server.kill(); }
