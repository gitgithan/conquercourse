// The launch demos: the ideal-run bot pulls the pin, lets the rider go at the planned moment (and grabs the bar when there is one) and clears the course; screenshots on the way.
// Usage: node scripts/launch-check.mjs   (QUERY=?course=/assets/demo/launch-bar.course.json for the bar variant)
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
  const name = process.env.NAME ?? 'launch';
  mkdirSync(`test-results/${name}`, { recursive: true });
  await page.goto(`http://localhost:${port}/${process.env.QUERY ?? '?course=/assets/demo/launch.course.json'}&bot=ideal&debug=1`);
  await page.waitForSelector('#debugbtn', { timeout: 60000 });
  const checks = {};
  let shot = 0, sawWait = false, sawLetGo = false, cleared = false;
  for (let i = 0; i < Number(process.env.SECONDS ?? 60) && !cleared; i++) {
    await page.waitForTimeout(500);
    const body = await page.textContent('body');
    if (/LET GO NOW|Wait for it/.test(body) && !sawLetGo) { sawLetGo = /LET GO NOW/.test(body); if (sawLetGo) await page.screenshot({ path: `test-results/${name}/letgo.png` }); }
    sawWait ||= /Wait for it/.test(body);
    if (i % (Number(process.env.EVERY ?? 3)) === 0) await page.screenshot({ path: `test-results/${name}/t${String(shot++).padStart(2, '0')}.png` });
    cleared = /You made it/.test(body);
  }
  await page.screenshot({ path: `test-results/${name}/end.png` });
  checks.sawWaitHint = sawWait; checks.sawLetGoHint = sawLetGo; checks.cleared = cleared;
  console.log(checks, 'errors:', errors);
  await browser.close();
} finally { server.kill(); }
