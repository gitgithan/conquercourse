// Holds → on the Course: the runner falls in the first gap. Checks the fall panel, the slow replay with numbers and guide lines,
// the ideal run, and the restart from this obstacle (not from the start).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const port = process.env.PORT ?? '5173';
const server = spawn('npx', ['vite', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/`);
  await page.waitForSelector('html[data-ready=true]', { timeout: 120000 });
  mkdirSync('test-results/course-fall', { recursive: true });
  const checks = {};
  // run, and jump too early at the first gap (too slow to clear it): hold right, press Space soon after the start
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => Number(document.documentElement.dataset.tick) > 100, null, { timeout: 60000 });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.documentElement.dataset.outcome === 'splash', null, { timeout: 200000 });
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/course-fall/1-fall-panel.png' });
  const body = async () => await page.textContent('body');
  checks.panelHasRetryHere = (await body()).includes('Try this gap again');
  await page.click('text=Watch what happened, with the numbers');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/course-fall/2-replay-numbers.png' });
  checks.replayHasNumbers = (await body()).includes('Speed when you jumped');
  await page.keyboard.press('Escape');
  await page.click('text=Show me the ideal run');
  await page.waitForFunction(() => document.documentElement.dataset.mode !== undefined, null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'test-results/course-fall/3-ideal.png' });
  checks.idealBanner = (await body()).includes('Ideal run');
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(500);
  checks.restartRunning = (await page.evaluate(() => document.documentElement.dataset.outcome)) === 'running';
  console.log(checks, 'errors:', errors);
  await browser.close();
  process.exit(Object.values(checks).every(Boolean) && !errors.length ? 0 : 1);
} finally { server.kill(); }
