// CC-108: the board is a card on the Course and the Help chip sits top right. One screenshot at 1280 x 720.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5301', out = process.argv[2] ?? 'test-results/board';
mkdirSync(out, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
try {
  await new Promise((r) => setTimeout(r, 5000));
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message.slice(0, 100)));
  await page.goto(`http://localhost:${port}/?course=/assets/demo/lache.course.json&welcome=0`);
  await page.waitForSelector('#board-corner', { timeout: 90000 });
  await page.waitForTimeout(3000);
  const at = await page.evaluate(() => Object.fromEntries(['#chelp', '#board-corner'].map((s) => { const b = document.querySelector(s)?.getBoundingClientRect(); return [s, b ? [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)] : null]; })));
  console.log(JSON.stringify(at), JSON.stringify(errors));
  await page.screenshot({ path: `${out}/board-corner.png` });
  await browser.close();
} finally { server.kill(); }
