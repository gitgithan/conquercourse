// CC-200: the World Editor opens with the Design partner hidden, the water level at 0 and a labelled Start; one screenshot at 1280 px.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5180';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
try {
  await new Promise((r) => setTimeout(r, 4000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  mkdirSync('test-results/editor', { recursive: true });
  await page.goto(`http://localhost:${port}/?mode=editor`);
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('cc.partner.open', '1'); }); // an old self-opened flag must not matter
  await page.reload();
  await page.waitForSelector('#view3d', { timeout: 60000 });
  await page.waitForFunction(() => Number(document.documentElement.dataset.pieces) >= 3, null, { timeout: 60000 });
  await page.waitForTimeout(4000);
  const checks = {};
  checks.partnerHidden = await page.evaluate(() => document.getElementById('helper').classList.contains('closed') && getComputedStyle(document.getElementById('helper')).visibility === 'hidden');
  checks.partnerTabVisible = await page.isVisible('#partnertab');
  checks.levelZero = await page.evaluate(() => { const i = document.getElementById('level'); return i ? Number(i.value) === 0 : null; });
  await page.click('#glossaryhide').catch(() => {}); await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/editor/defaults.jpg', type: 'jpeg', quality: 70 });
  await page.click('#partnertab');
  checks.tabOpens = await page.evaluate(() => !document.getElementById('helper').classList.contains('closed'));
  await page.reload(); await page.waitForSelector('#view3d'); await page.waitForTimeout(3000);
  checks.remembersHandChoice = await page.evaluate(() => !document.getElementById('helper').classList.contains('closed'));
  await page.click('#partnertab');
  console.log(checks, 'errors:', errors);
  await browser.close();
  process.exit(Object.values(checks).every((v) => v !== false) && !errors.length ? 0 : 1);
} finally { server.kill(); }
