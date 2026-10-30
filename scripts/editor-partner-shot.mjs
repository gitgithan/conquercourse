// CC-243: the Design partner is a docked row in the right column (no floating card). Shots at 1280 x 720 and 1280 x 800, partner open and closed.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5199', out = process.argv[2] ?? 'test-results/partner';
mkdirSync(out, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const errors = [];
try {
  await new Promise((r) => setTimeout(r, 5000));
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  for (const h of [720, 800]) {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: h } })).newPage();
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 100)));
    await page.goto(`http://localhost:${port}/?mode=editor&welcome=0`);
    await page.waitForSelector('#view3d', { timeout: 90000 });
    await page.waitForFunction(() => Number(document.documentElement.dataset.pieces) >= 3, null, { timeout: 90000 });
    await page.waitForTimeout(3000);
    if (await page.isVisible('#edglossary')) await page.click('#glossaryhide');
    if (!(await page.isVisible('#helper'))) await page.click('#helperbtn');
    await page.waitForTimeout(500);
    const box = await page.evaluate(() => { const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; }; return { helper: r('#helper'), aside: r('.aside'), panel: r('#panel') }; });
    console.log(h, JSON.stringify(box), await page.evaluate(() => `${document.querySelector('#helper').parentElement.className} | ${document.querySelector('.ed')?.className} | ${document.querySelector('#fixmenubtn') ? 'fixmenu' : 'nofixmenu'}`));
    await page.screenshot({ path: `${out}/partner-${h}.png` });
    await page.click('#helperbtn'); await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/partner-closed-${h}.png` });
  }
  console.log('errors', JSON.stringify(errors));
  await browser.close();
} finally { server.kill(); }
