// Screenshots of step 1 ("Why it matters") for every obstacle: the real-obstacle and the idea diagrams.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const server = spawn('npx', ['vite', '--port', port, '--strictPort'], { stdio: 'ignore' });
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  mkdirSync('test-results/dojo-step1', { recursive: true });
  for (const ex of ['gap', 'wall', 'rope', 'trampoline', 'landing']) {
    await page.goto(`http://localhost:${port}/?mode=dojo&ex=${ex}`);
    await page.waitForSelector('html[data-ready=true]');
    await page.screenshot({ path: `test-results/dojo-step1/${ex}-real.png` });
    await page.click('text=The idea');
    await page.screenshot({ path: `test-results/dojo-step1/${ex}-idea.png` });
  }
  await browser.close();
} finally { server.kill(); }
