// CC-240: the slide on the Cannonballs course. Pictures: running, then 0.2 s and 0.6 s into a slide (S pressed at a jog), and standing again.
// Usage: node scripts/slide-check.mjs [outdir]   (desktop 1280 only; run on the VM; PORT=5199)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
const out = process.argv[2] ?? 'test-results/slide'; mkdirSync(out, { recursive: true });
const port = process.env.PORT ?? '5199';
// the Cannonballs course without its balls (a knee-high ball hits a slider too, and would end the picture): a temporary copy, removed at the end
const tmp = 'public/assets/demo/_slide-check.course.json';
writeFileSync(tmp, JSON.stringify({ ...JSON.parse(readFileSync('public/assets/demo/cannonballs.course.json', 'utf8')), shots: [] }));
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'];
let bad = 0; const check = (n, ok) => { console.log(ok ? 'ok  ' : 'FAIL', n); if (!ok) bad++; };
try {
  await new Promise((r) => setTimeout(r, 6000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const tick = () => page.evaluate(() => Number(document.documentElement.dataset.tick));
  // the game runs on a fake clock that only moves when this script moves it: a slow software-GPU screenshot cannot let the run race ahead
  await page.clock.install();
  const runTo = async (n) => { for (let i = 0; i < 4000 && (await tick()) < n; i++) await page.clock.runFor(50); };
  await page.goto(`http://localhost:${port}/?course=/assets/demo/_slide-check.course.json&startx=0&welcome=0&tour=0&nav=0`);
  for (let i = 0; i < 4000 && !(await page.evaluate(() => document.documentElement.dataset.ready === 'true')); i++) await page.clock.runFor(100);
  await page.keyboard.press('KeyH'); // hide the key card
  await page.keyboard.down('ArrowRight');
  await runTo(100); // about 0.8 s of running: past the 4 m/s a slide needs, and well before the first gap
  await page.screenshot({ path: `${out}/1-running.png` });
  const t0 = await tick();
  await page.keyboard.press('KeyS');
  await runTo(t0 + 24); // 0.2 s in: the drop is done
  await page.screenshot({ path: `${out}/2-slide-0.2s.png` });
  await runTo(t0 + 60); // 0.6 s in: low and sliding
  await page.screenshot({ path: `${out}/3-slide-0.6s.png` });
  await runTo(t0 + 110); // the slide has ended and the body is up again
  await page.screenshot({ path: `${out}/4-up-again.png` });
  check('four pictures taken, last at tick ' + await tick(), true);
  await browser.close();
} catch (e) { console.log('FAIL', String(e).slice(0, 300)); bad++; } finally { server.kill(); rmSync(tmp, { force: true }); }
console.log(bad ? 'FAILED' : 'PASS'); process.exit(bad ? 1 : 0);
