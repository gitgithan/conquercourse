// Holds → on the Course: the runner falls in the first gap. Checks the fall panel, the replay and a clean retry.
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
  await page.screenshot({ path: 'test-results/course-fall/0-start-hint.png' });
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => document.documentElement.dataset.outcome === 'splash', null, { timeout: 200000 });
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/course-fall/1-fall-panel.png' });
  const text = await page.textContent('body');
  console.log('panel says fell:', text.includes('You fell in the water'), '| train offered:', text.includes('Train the'));
  await page.click('text=Watch what happened');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/course-fall/2-replay.png' });
  await page.keyboard.press('Escape');
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(500);
  const outcome = await page.evaluate(() => document.documentElement.dataset.outcome);
  console.log('after retry outcome:', outcome, 'errors:', errors);
  await browser.close();
  process.exit(outcome === 'running' && !errors.length ? 0 : 1);
} finally { server.kill(); }
