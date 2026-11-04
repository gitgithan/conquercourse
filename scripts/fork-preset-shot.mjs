// CC-133: opens the World Editor, picks the fork course from "Ready-made courses…" and saves a screenshot with the verdict.
// Usage: node scripts/fork-preset-shot.mjs   (writes test-results/cc-133-fork-preset/editor.png)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
try {
  await new Promise((r) => setTimeout(r, 4000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', (e) => { errors.push(e.message); console.log('PAGEERROR', e.message.slice(0, 200)); });
  const missing = []; page.on('response', (r) => { if (r.status() >= 400) missing.push(r.status() + ' ' + r.url()); });
  page.on('dialog', (d) => d.accept()); // "Replace the pieces on the screen?"
  mkdirSync('test-results/cc-133-fork-preset', { recursive: true });
  await page.goto(`http://localhost:${port}/?mode=editor&welcome=0`);
  await page.waitForSelector('#presetpick', { timeout: 90000 });
  await page.waitForTimeout(3000);
  await page.selectOption('#presetpick', 'fork');
  await page.waitForLoadState('load');
  await page.waitForSelector('#presetpick', { timeout: 90000 });
  await page.waitForTimeout(25000); // the lane check and the photo objects
  await page.getByText('Hide', { exact: true }).first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/cc-133-fork-preset/editor.png' });
  const verdict = await page.evaluate(() => document.querySelector('#verdict')?.textContent ?? '');
  console.log({ verdict, laneState: await page.evaluate(() => document.documentElement.dataset.laneState), missing, errors });
  await browser.close();
  process.exit(errors.length ? 1 : 0);
} finally { server.kill(); }
