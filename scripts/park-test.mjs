// Browser test for the Park (CC-25): two photos -> edit boxes -> make the course -> the ideal bot runs it -> "cleared".
// Run: PORT=5199 node scripts/park-test.mjs   (headless Chromium, WebGPU on SwiftShader; one run at a time)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const port = process.env.PORT ?? '5173';
const photos = (process.env.PHOTOS ?? 'park01,park07').split(',');
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader',
  '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
let failed = false;
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  mkdirSync('test-results', { recursive: true });
  for (const photo of photos) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    page.on('pageerror', (e) => console.error('pageerror', e.message));
    await page.goto(`http://localhost:${port}/?mode=park&photo=${photo}&bot=ideal`);
    await page.waitForSelector('.park .box', { timeout: 30000 });
    await page.waitForTimeout(500);
    const n0 = await page.locator('.park .box').count();
    await page.screenshot({ path: `test-results/park-${photo}-boxes.png` });
    if (photo === photos[0]) { // the editable-boxes fallback: add, drag, resize, retype, delete
      await page.click('#add');
      const added = page.locator('.park .box.sel');
      const b0 = await added.boundingBox();
      await page.mouse.move(b0.x + b0.width / 2, b0.y + b0.height / 2);
      await page.mouse.down(); await page.mouse.move(b0.x + b0.width / 2 + 60, b0.y + b0.height / 2 + 30, { steps: 5 }); await page.mouse.up();
      const b1 = await page.locator('.park .box.sel').boundingBox();
      const handle = page.locator('.park .box.sel i');
      const hb = await handle.boundingBox();
      await page.mouse.move(hb.x + 8, hb.y + 8); await page.mouse.down(); await page.mouse.move(hb.x + 48, hb.y + 28, { steps: 5 }); await page.mouse.up();
      const b2 = await page.locator('.park .box.sel').boundingBox();
      await page.selectOption('#what', 'ledge');
      const moved = Math.abs(b1.x - b0.x) > 30, grown = b2.width > b1.width + 20;
      console.log(photo, 'edit: moved', moved, 'resized', grown, 'label', await page.locator('.park .box.sel span').textContent());
      if (!moved || !grown) failed = true;
      await page.click('#del');
      const n1 = await page.locator('.park .box').count();
      console.log(photo, 'boxes', n0, '-> after add+delete', n1);
      if (n1 !== n0) failed = true;
    }
    await page.click('#make');
    await page.waitForSelector('#proof');
    const proof = await page.textContent('#proof');
    console.log(photo, 'proof:', proof);
    await page.screenshot({ path: `test-results/park-${photo}-primitives.png`, fullPage: true });
    if (!proof.includes('found a way')) failed = true;
    await page.click('#run');
    await page.waitForSelector('html[data-outcome]', { timeout: 120000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `test-results/park-${photo}-course.png` });
    await page.waitForFunction(() => document.documentElement.dataset.outcome !== 'running', null, { timeout: 180000 });
    const outcome = await page.evaluate(() => document.documentElement.dataset.outcome);
    await page.screenshot({ path: `test-results/park-${photo}-cleared.png` });
    console.log(photo, 'outcome:', outcome);
    if (outcome !== 'cleared') failed = true;
    await page.close();
  }
  await browser.close();
} finally {
  server.kill();
}
if (failed) { console.error('PARK TEST FAILED'); process.exit(1); }
console.log('PARK TEST PASSED');
