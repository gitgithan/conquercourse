// Opens the Dojo, makes three close guesses at different settings on the gap jump, and checks the saying is earned.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const port = process.env.PORT ?? '5173';
const server = spawn('npx', ['vite', '--port', port, '--strictPort'], { stdio: 'ignore' });
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/?mode=dojo`);
  await page.waitForSelector('html[data-ready=true]');
  mkdirSync('test-results/dojo', { recursive: true });
  const set = (id, v) => page.$eval(`#${id}`, (el, v) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  // gap: the truth is 2 * speed * jump / 9.81; guess it exactly at three different settings
  const settings = [[7, 4.5], [6, 3.5], [8, 5]];
  let before = await page.textContent('body');
  console.log('saying shown before:', before.includes('already decided'));
  for (const [speed, jump] of settings) {
    await set('knob-speed', speed); await set('knob-jump', jump);
    await set('guess', (2 * speed * jump) / 9.81);
    await page.click('#run');
    await page.screenshot({ path: `test-results/dojo/gap-${speed}-${jump}.png` });
  }
  const after = await page.textContent('body');
  console.log('saying shown after three close guesses:', after.includes('already decided'));
  console.log('errors:', errors);
  await browser.close();
  process.exit(after.includes('already decided') && !before.includes('already decided') && !errors.length ? 0 : 1);
} finally { server.kill(); }
