// Screenshot of Video to motion step 5 (character with its bones, the clock and the size slider) at 1280 px.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  mkdirSync('test-results/lab-motion', { recursive: true });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await page.goto(`http://localhost:${port}/?mode=lab-motion&labs=1&backend=webgl2`);
  await page.waitForFunction(() => document.documentElement.dataset.motionRookie === '1', null, { timeout: 120000 });
  await page.evaluate(() => document.querySelector('#s5').scrollIntoView());
  await page.fill('#mo-tick', '30'); await page.dispatchEvent('#mo-tick', 'input');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/lab-motion/s5-tick30.png' });
  await page.fill('#mo-size', '0.2'); await page.dispatchEvent('#mo-size', 'input');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/lab-motion/s5-speed.png' });
  await browser.close();
} finally { server.kill(); }
