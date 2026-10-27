// Opens the Landing lesson and saves the push-against-time graph at two knee-bend times.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/?mode=dojo&ex=landing`);
  await page.waitForSelector('html[data-ready=true]');
  mkdirSync('test-results/dojo', { recursive: true });
  const set = (id, v) => page.$eval(`#${id}`, (el, v) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  await page.click('#next');
  await set('knob-bend', 0.1); await page.click('#run'); await set('knob-bend', 0.3);
  await page.screenshot({ path: 'test-results/dojo/landing-try.png' });
  for (let i = 0; i < 3; i++) await page.click('#next');
  await set('knob-bend', 0.2);
  await page.screenshot({ path: 'test-results/dojo/landing-formula.png' });
  console.log('answer:', await page.textContent('#answer'), 'errors:', errors);
  await browser.close();
} finally { server.kill(); }
