// Counts the words a new player sees on the Course: at the very start, and after the first jump (the controls card then folds away).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT ?? '5173';
const server = spawn('npx', ['vite', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/?bot=ideal`);
  await page.waitForSelector('html[data-ready=true]', { timeout: 120000 });
  const words = () => page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => e.children.length === 0 && e.textContent.trim() && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden').map((e) => e.textContent.trim()).join(' ').split(/\s+/).length);
  const atStart = await words();
  const cardAtStart = await page.$eval('#keys', (e) => e.innerText.split(/\s+/).length);
  await page.waitForFunction(() => Number(document.documentElement.dataset.tick) > 600, null, { timeout: 200000 });
  const afterJump = await words();
  const cardAfter = await page.$eval('#keys', (e) => e.innerText.split(/\s+/).length);
  console.log({ wordsAtStart: atStart, wordsAfterFirstJump: afterJump, controlsCardAtStart: cardAtStart, controlsCardAfter: cardAfter }, 'errors:', errors);
  await browser.close();
  process.exit(cardAfter < cardAtStart && !errors.length ? 0 : 1);
} finally { server.kill(); }
