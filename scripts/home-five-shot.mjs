// CC-133: 1280x720 screenshot of the first-visit tour's "More to explore" step with the five cards.
//   node scripts/home-five-shot.mjs [outfile]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const out = process.argv[2] ?? 'test-results/home-five.png';
const port = process.env.PORT ?? '5184';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
try {
  await new Promise((r) => setTimeout(r, 4000));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`http://localhost:${port}/?entrance=1&tourstep=600&music=0`);
  await page.waitForSelector('#tour', { timeout: 120000 });
  for (let i = 0; i < 4; i++) { await page.click('#tour-next'); await page.waitForTimeout(300); }
  await page.waitForSelector('#tour .place.wide');
  await page.waitForTimeout(800);
  await page.screenshot({ path: out });
  await browser.close();
} finally { server.kill(); }
