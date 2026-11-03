// Meet the crew cards: opens the dialog at 1280 x 720, waits for the run loops, and saves a picture. Usage: node scripts/crew-cards-check.mjs [outdir]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5288', out = process.argv[2] ?? 'test-results/crew-cards'; mkdirSync(out, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const base = `http://localhost:${port}/`, wait = (ms) => new Promise((r) => setTimeout(r, ms)), checks = {};
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(base)).ok) break; } catch { /* not up yet */ } await wait(1000); }
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const errs = [], page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); page.setDefaultTimeout(120000);
  page.on('pageerror', (e) => errs.push(e.message.slice(0, 120)));
  await page.goto(`${base}?welcome=1`, { waitUntil: 'load' });
  await page.waitForSelector('#welcome-crew'); await page.click('#welcome-crew'); await page.waitForSelector('#crew-cards li');
  await page.waitForFunction(() => document.querySelectorAll('#crew-cards canvas[data-live]').length >= 10, null, { timeout: 120000 }).catch(() => {});
  const info = await page.evaluate(() => ({ cards: document.querySelectorAll('#crew-cards > li').length, live: document.querySelectorAll('#crew-cards canvas[data-live]').length, says: document.querySelectorAll('#crew-dialog .says').length, make: !!document.getElementById('crew-make') }));
  checks['10 cards'] = info.cards === 10; checks['live loops'] = info.live; checks['no says pills'] = info.says === 0; checks['make button'] = info.make;
  await page.screenshot({ path: `${out}/crew-cards-1280.png` });
  await page.click('#crew-make'); await page.waitForSelector('#chars'); await wait(800);
  await page.screenshot({ path: `${out}/crew-make-1280.png` });
  await page.keyboard.press('Escape'); await wait(200);
  checks['Esc closes maker only'] = !(await page.$('#chars')) && !!(await page.$('#crew-dialog'));
  checks['no page errors'] = errs.length === 0; if (errs.length) console.log(errs.slice(0, 6));
  await browser.close();
} finally { server.kill(); }
console.log(JSON.stringify(checks, null, 1));
