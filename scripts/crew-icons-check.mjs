// CC-243: Meet the crew icons and click-outside-to-close. 1280 x 720, desktop only. Usage: node scripts/crew-icons-check.mjs [outdir]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5287', out = process.argv[2] ?? 'test-results/crew-icons'; mkdirSync(out, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const checks = {}, base = `http://localhost:${port}/`, wait = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(base)).ok) break; } catch { /* not up yet */ } await wait(1000); }
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const errs = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); page.setDefaultTimeout(120000); page.on('pageerror', (e) => errs.push(e.message.slice(0, 120)));
  // 1. Meet the crew from the welcome page
  await page.goto(`${base}?welcome=1`, { waitUntil: 'load' });
  await page.waitForSelector('#welcome-crew', { timeout: 120000 }).catch(async (e) => { await page.screenshot({ path: out + '/welcome-err.png' }); throw e; }); await page.click('#welcome-crew'); await page.waitForSelector('#crew'); await wait(500);
  const info = await page.evaluate(() => ({
    cards: document.querySelectorAll('#crew > li').length,
    legend: [...document.querySelectorAll('#crew-legend li[data-screen]')].map((l) => l.dataset.screen),
    railsOk: [...document.querySelectorAll('#crew > li')].every((c) => c.querySelectorAll('.crew-rail li svg[aria-label]').length >= 1),
    tipsOk: [...document.querySelectorAll('.crew-rail li')].every((l) => l.title && l.title.length > 2),
    legendVisible: (() => { const r = document.getElementById('crew-legend').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })(),
  }));
  checks['10 cards'] = info.cards === 10; checks['legend has 7 rows'] = info.legend.length === 7;
  checks['every card has labelled icons'] = info.railsOk; checks['every icon has a tooltip'] = info.tipsOk; checks['legend in view'] = info.legendVisible;
  await page.screenshot({ path: `${out}/crew-icons-1280.png` });
  // drag from inside the dialog card to the backdrop must not close it
  const box = await page.locator('#crew-dialog > div').boundingBox();
  await page.mouse.move(box.x + 40, box.y + 20); await page.mouse.down(); await page.mouse.move(5, 5); await page.mouse.up();
  checks['crew: drag from inside to outside keeps it open'] = !!(await page.$('#crew-dialog'));
  await page.mouse.click(5, 5); await wait(200);
  checks['crew: click outside closes'] = !(await page.$('#crew-dialog'));
  // 2. Character picker
  await page.goto(`${base}?welcome=0`, { waitUntil: 'load' });
  await page.waitForSelector('#characters-btn', { timeout: 120000 }); await page.click('#characters-btn'); await page.waitForSelector('#chars'); await wait(800);
  await page.screenshot({ path: `${out}/characters-open-1280.png` });
  const cb = await page.locator('#chars .box').boundingBox();
  await page.mouse.move(cb.x + 30, cb.y + 20); await page.mouse.down(); await page.mouse.move(3, 3); await page.mouse.up(); await wait(200);
  checks['picker: drag from inside to outside keeps it open'] = !!(await page.$('#chars'));
  await page.mouse.click(cb.x + 30, cb.y + 20); await wait(200);
  checks['picker: click inside keeps it open'] = !!(await page.$('#chars'));
  await page.mouse.click(3, 3); await wait(300);
  checks['picker: click outside closes'] = !(await page.$('#chars'));
  await page.screenshot({ path: `${out}/characters-closed-1280.png` });
  await page.click('#characters-btn'); await page.waitForSelector('#chars'); await page.keyboard.press('Escape'); await wait(200);
  checks['picker: Esc still closes'] = !(await page.$('#chars'));
  checks['no page errors'] = errs.length === 0; if (errs.length) console.log(errs.slice(0, 6));
  await browser.close();
} finally { server.kill(); }
console.log(JSON.stringify(checks, null, 1));
process.exitCode = Object.values(checks).every(Boolean) ? 0 : 1;
