// Clicks the male and female Rookie icons on the Course and saves a screenshot of each.
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
  mkdirSync('test-results/rookie-pick', { recursive: true });
  const checks = {};
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/rookie-pick/male.png' });
  await page.click('button[aria-label="Run as the female Rookie"]');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'test-results/rookie-pick/female.png' });
  checks.savedFemale = (await page.evaluate(() => localStorage.getItem('cc.rookie'))) === 'b';
  checks.femalePressed = (await page.getAttribute('button[aria-label="Run as the female Rookie"]', 'aria-pressed')) === 'true';
  console.log(checks, 'errors:', errors);
  await browser.close();
  process.exit(Object.values(checks).every(Boolean) && !errors.length ? 0 : 1);
} finally { server.kill(); }
