// CC-96: the person for scale. A first visit shows the chip and the person; Hide removes them; the chip brings them back and frames them; the choice is remembered.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5191', out = process.env.OUT ?? 'data/eval/cc-96-piece-browser';
mkdirSync(out, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--use-angle=swiftshader', '--ignore-gpu-blocklist'];
const checks = {}, errors = [];
try {
  await new Promise((r) => setTimeout(r, 3500));
  const browser = await chromium.launch({ args: flags });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 100)));
  await page.goto(`http://localhost:${port}/?mode=editor&welcome=0`);
  await page.waitForSelector('#personfind', { timeout: 90000 });
  await page.waitForFunction(() => document.querySelector('#personfind')?.textContent === 'Find the person', null, { timeout: 60000 });
  checks['first visit: the chip says Find the person'] = true;
  checks['first visit: the Hide button shows'] = await page.isVisible('#personhide');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/person-first-visit.png` });
  await page.click('#personfind'); await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/person-found.png` });
  checks['finding the person does not remove them'] = (await page.textContent('#personfind')) === 'Find the person';
  await page.click('#personhide'); await page.waitForFunction(() => document.querySelector('#personfind')?.textContent === 'Show a person', null, { timeout: 20000 });
  checks['Hide removes the person'] = !(await page.isVisible('#personhide'));
  await page.reload(); await page.waitForSelector('#personfind', { timeout: 90000 }); await page.waitForTimeout(3000);
  checks['the hidden choice is remembered after a reload'] = (await page.textContent('#personfind')) === 'Show a person';
  await page.click('#personfind'); await page.waitForFunction(() => document.querySelector('#personfind')?.textContent === 'Find the person', null, { timeout: 30000 });
  checks['the chip shows the person again'] = true;
  await page.waitForTimeout(1200); await page.screenshot({ path: `${out}/person-back.png` });
  await page.close(); await browser.close();
} finally { server.kill(); }
const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
console.log(JSON.stringify(checks, null, 2), '\nerrors', errors);
console.log(failed.length || errors.length ? `FAIL: ${failed.join('; ')}` : 'PASS');
process.exit(failed.length || errors.length ? 1 : 0);
