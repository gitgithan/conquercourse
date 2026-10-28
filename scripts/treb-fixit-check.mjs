// The editor with a trebuchet: Fix it changes the counterweight first and shows it as a preview with plain words.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5181';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  const errors = []; page.on('pageerror', (e) => { errors.push(e.message); console.log('PAGEERROR', e.message.slice(0, 200)); });
  await page.goto(`http://localhost:${port}/?mode=editor`);
  await page.waitForSelector('#view3d', { timeout: 60000 });
  await page.waitForFunction(() => document.documentElement.dataset.pieces === '3', null, { timeout: 30000 });
  mkdirSync('test-results/treb-fixit', { recursive: true });
  const out = {};
  await page.click('#addpiece'); await page.click('#addtreb');
  await page.fill('#trebkg', '300');
  await page.dispatchEvent('#trebkg', 'change');
  await page.waitForTimeout(2500);
  out.verdictLight = await page.evaluate(() => document.querySelector('#verdict, .verdict')?.textContent ?? document.body.innerText.match(/The simulator[^.]*\./)?.[0]);
  await page.click('#fixit');
  await page.waitForFunction(() => document.documentElement.dataset.fixed !== undefined && document.documentElement.dataset.preview !== undefined, null, { timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(1500);
  out.card = await page.evaluate(() => document.querySelector('.reply')?.innerText ?? '');
  out.state = await page.evaluate(() => ({ fixed: document.documentElement.dataset.fixed, preview: document.documentElement.dataset.preview, items: document.documentElement.dataset.previewItems }));
  await page.screenshot({ path: 'test-results/treb-fixit/card.png' });
  if (out.state.preview) { await page.click('#applypreview').catch(() => {}); await page.waitForTimeout(500); out.kgAfter = await page.inputValue('#trebkg'); }
  const checks = { cardSaysTheCounterweight: /Use a \d+ kg counterweight \(now 300 kg\)/.test(out.card), previewClears: out.state.preview === 'clears', appliedToTheBox: Number(out.kgAfter) > 300, noPageErrors: errors.length === 0 };
  console.log(JSON.stringify({ ...out, checks, errors }, null, 1));
  if (!Object.values(checks).every(Boolean)) process.exitCode = 1;
  await browser.close();
} finally { server.kill(); }
