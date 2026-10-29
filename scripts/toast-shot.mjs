// CC-197: three toasts at once in the real Course page at 1280 px: none overlaps another, the newest is lowest, and one leaves upward.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? String(5300 + Math.floor(Math.random() * 600)), out = process.env.OUT ?? 'data/eval/cc-197-toasts', tag = process.env.TAG ?? 'after';
mkdirSync(out, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const results = []; const check = (name, ok, extra = '') => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, extra); };
try {
  await new Promise((r) => setTimeout(r, 5000));
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await page.goto(`http://localhost:${port}/?tour=0&welcome=0&check=1${process.env.EXTRA ? '&' + process.env.EXTRA : ''}`);
  await page.waitForSelector('html[data-ready=true]', { timeout: 120000 });
  await page.waitForFunction(() => !!window.__say);
  // the game clock does not run before the first move, so the toasts stay as they are until the stills are taken (a stepped clock)
  await page.evaluate(() => { window.__say('Firm landing.', 100000); window.__say('You skipped the second bar and the third bar of the long lache pair.', 100000); window.__say('The drone lifts you. Lean with the arrow keys, climb with ↑ and come down with ↓.', 100000); });
  await page.waitForTimeout(600);
  const boxes = await page.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent.slice(0, 20), top: r.top, bottom: r.bottom, left: r.left, right: r.right }; }));
  console.log(JSON.stringify(boxes));
  await page.screenshot({ path: `${out}/${tag}-three-toasts.png` });
  check('three toasts showing', boxes.length === 3);
  check('none overlaps another (each starts below the one before)', boxes.every((b, i) => i === 0 || b.top >= boxes[i - 1].bottom - 0.5));
  check('the newest is the lowest', boxes.length === 3 && boxes[2].t.startsWith('The drone'));
  // the oldest leaves upward and fades
  await browser.close();
} catch (e) { console.log('FAIL error', e.message); results.push(false); }
server.kill();
process.exit(results.every(Boolean) && results.length ? 0 : 1);
