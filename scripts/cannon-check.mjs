// CC-240: the fire meter  on the Cannonballs course. One picture: the cannon filling (the charge bar above the barrel, a plunger part-way along it). The slide is covered by tests/slide.test.ts.
// Usage: node scripts/cannon-check.mjs [outdir]   (desktop 1280 only; run on the VM; PORT=5199)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'test-results/cannon'; mkdirSync(out, { recursive: true });
const port = process.env.PORT ?? '5199';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'];
let bad = 0; const check = (n, ok) => { console.log(ok ? 'ok  ' : 'FAIL', n); if (!ok) bad++; };
try {
  await new Promise((r) => setTimeout(r, 6000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const tick = () => page.evaluate(() => Number(document.documentElement.dataset.tick));
  await page.goto(`http://localhost:${port}/?course=/assets/demo/cannonballs.course.json&startx=30&welcome=0&tour=0&nav=0`);
  await page.waitForSelector('html[data-ready=true]', { timeout: 180000 });
  await page.keyboard.press('KeyH'); // hide the key card
  await page.waitForFunction(() => Number(document.documentElement.dataset.tick) >= 150, null, { timeout: 200000, polling: 20 }); // 1.25 s: the cannon at x 24 is about 60% through its first charge; the runner stands behind the muzzle, out of the line of fire
  await page.screenshot({ path: `${out}/fire-meter.png` });
  check('fire meter picture taken at tick ' + await tick(), true);
  await browser.close();
} catch (e) { console.log('FAIL', String(e).slice(0, 300)); bad++; } finally { server.kill(); }
console.log(bad ? 'FAILED' : 'PASS'); process.exit(bad ? 1 : 0);
