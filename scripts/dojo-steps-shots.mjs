// CC-146: a picture of every step of some Dojo lessons, to look for overlapping text and a stretched swing picture.
// Usage: node scripts/dojo-steps-shots.mjs <outdir> [lesson,lesson]   (desktop 1280 only; run on a VM or a codespace)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'test-results/dojo-steps'; mkdirSync(out, { recursive: true });
const lessons = (process.argv[3] ?? 'coaster,stored,bars,rope').split(',');
const port = process.env.PORT ?? '5895';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
try {
  await new Promise((r) => setTimeout(r, 6000));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  for (const ex of lessons) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`http://localhost:${port}/?mode=dojo&ex=${ex}&welcome=0&tour=0`);
    await page.waitForSelector('#next', { timeout: 120000 });
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${out}/${ex}-${i}.png` });
      const next = await page.$('#next:not([disabled])');
      if (!next) break;
      await next.click();
    }
    await page.close();
  }
  await browser.close();
} finally { server.kill(); }
console.log('done');
