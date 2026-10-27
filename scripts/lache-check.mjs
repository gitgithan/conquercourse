// The lache demo: the ideal-run bot plays the whole course (run, vault, swing across two bars) and clears it; screenshots on the way.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', (e) => { errors.push(e.message); console.log('PAGEERROR', e.message.slice(0, 200)); });
  mkdirSync('test-results/lache', { recursive: true });
  await page.goto(`http://localhost:${port}/${process.env.QUERY ?? '?course=/assets/demo/lache.course.json'}&bot=ideal&debug=1`);
  await page.waitForSelector('#debugbtn', { timeout: 60000 });
  const checks = {};
  let shot = 0, sawHang = false, cleared = false;
  for (let i = 0; i < Number(process.env.SECONDS ?? 120) && !cleared; i++) {
    await page.waitForTimeout(1000);
    const body = await page.textContent('body');
    const hint = /Push [→←] with the swing/.test(body);
    if (hint && !sawHang) { sawHang = true; checks.frontViewShown = (await page.evaluate(() => getComputedStyle(document.getElementById('frontview')).display)) !== 'none'; await page.waitForTimeout(700); await page.screenshot({ path: 'test-results/lache/hang.png' }); }
    if (i % 6 === 0) await page.screenshot({ path: `test-results/lache/t${String(shot++).padStart(2, '0')}.png` });
    cleared = /You made it/.test(body);
  }
  await page.screenshot({ path: 'test-results/lache/end.png' });
  checks.sawHangHint = sawHang; checks.cleared = cleared;
  console.log(checks, 'errors:', errors);
  await browser.close();
} finally { server.kill(); }
