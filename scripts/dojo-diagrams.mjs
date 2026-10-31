// A picture of the "real obstacle" diagram of every Dojo lesson, to look for overlapping text (CC-183).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173', out = process.argv[2] ?? 'test-results/dojo-diagrams';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  mkdirSync(out, { recursive: true });
  for (const ex of (process.env.EX ?? 'band,coaster').split(',')) {
    await page.goto(`http://localhost:${port}/?mode=dojo&ex=${ex}&nav=0`);
    await page.waitForSelector('html[data-ready=true]');
    await page.screenshot({ path: `${out}/${ex}.png` });
  }
  await browser.close();
} finally { server.kill(); }
