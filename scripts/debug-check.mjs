// The debug view: B shows the collision outline, the body box and where a jump right now goes, with the reason in words.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', (e) => { errors.push(e.message); console.log('PAGEERROR', e.message.slice(0, 200)); });
  mkdirSync('test-results/debug', { recursive: true });
  const checks = {};
  await page.goto(`http://localhost:${port}/?course=/assets/demo/lane-1.course.json`);
  await page.waitForSelector('#debugbtn', { timeout: 60000 });
  await page.waitForTimeout(1500);
  checks.offAtStart = (await page.evaluate(() => getComputedStyle(document.getElementById('debugpanel')).display)) === 'none';
  await page.keyboard.press('KeyB');
  checks.bOpens = (await page.evaluate(() => getComputedStyle(document.getElementById('debugpanel')).display)) !== 'none';
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'test-results/debug/early.png' });
  await page.waitForTimeout(1300);
  const txt = await page.textContent('#debugpanel');
  checks.saysWhy = /(Jump now|Carry on|Let go now|Cart rolls on|Turn round now|Come down now)/.test(txt) && /(Lands|Hurts|Splash|Blocked|In the air|Other move)/.test(txt);
  console.log('PANEL:', txt.slice(0, 260));
  await page.screenshot({ path: 'test-results/debug/running.png' });
  await page.keyboard.up('ArrowRight');
  await page.click('#debugbtn');
  checks.buttonCloses = (await page.evaluate(() => getComputedStyle(document.getElementById('debugpanel')).display)) === 'none';
  console.log(checks, 'errors:', errors);
  await browser.close();
} finally { server.kill(); }
