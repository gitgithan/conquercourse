// Opens Statistics of timing (?mode=lab-timing&labs=1) at 1280 px, plays a course, checks the facts and saves a screenshot.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const port = process.env.PORT ?? '5181';
const out = process.argv[2] ?? 'test-results/lab-timing.png';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
let failed = '';
try {
  await new Promise((r) => setTimeout(r, 4000));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1500 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/?mode=lab-timing&labs=1&welcome=0`);
  await page.waitForSelector('html[data-lab-ready=true]', { timeout: 60000 });
  await page.selectOption('#lt-course', '3');
  await page.fill('#lt-sigma', '60');
  await page.dispatchEvent('#lt-sigma', 'input');
  await page.click('#lt-shape button[data-shape=normal]');
  await page.click('#lt-run');
  await page.waitForSelector('html[data-lab-done="1"]', { timeout: 120000 });
  const facts = await page.textContent('#lt-facts');
  console.log(facts);
  if (!/Clear rate/.test(facts) || !/Window for 90% clear/.test(facts)) failed = 'facts missing';
  await page.click('#lt-eq-btn');
  mkdirSync('test-results', { recursive: true });
  await page.screenshot({ path: out, fullPage: false });
  if (errors.length) failed = failed || `page errors: ${errors.join('; ')}`;
  await browser.close();
} finally {
  server.kill();
}
if (failed) { console.error('FAIL', failed); process.exit(1); }
console.log('ok');
