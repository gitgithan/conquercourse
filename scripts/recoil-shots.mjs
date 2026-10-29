// Screenshots for CC-66: the editor with a launcher on the start deck (and its verdict), and the Dojo lesson.
// Usage: node scripts/recoil-shots.mjs   (writes test-results/recoil/editor.png and dojo.png)
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
  mkdirSync('test-results/recoil', { recursive: true });
  await page.goto(`http://localhost:${port}/?mode=editor`);
  await page.waitForSelector('#addrecoil', { state: 'attached', timeout: 60000 });
  await page.click('#addpiece'); await page.$eval('#addrecoil', (e) => e.click());
  const knobs = await page.$$eval('#recoilkg, #recoilspeed', (els) => els.map((e) => e.value));
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/recoil/editor.png' });
  await page.goto(`http://localhost:${port}/?mode=dojo&ex=recoil`);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/recoil/dojo.png' });
  const body = await page.textContent('body');
  console.log({ knobs, dojoMentionsRecoil: /Recoil/.test(body) }, 'errors:', errors);
  await browser.close();
  process.exit(errors.length ? 1 : 0);
} finally { server.kill(); }
