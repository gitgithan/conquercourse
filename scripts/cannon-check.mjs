// The cannon demo. Part 1 (bot): the ideal-run bot aims, fires and rolls out of the landing, and clears; screenshots at the pad, the shot and the landing.
// Part 2 (keys): a player runs onto the pad, tilts the barrel with Up and Down and sees the aim change in the words and the dots move.
// Usage: node scripts/cannon-check.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const url = `http://localhost:${port}/?course=/assets/demo/cannon.course.json`;
const aimOf = (t) => Number((t.match(/aim (\d+)°/) ?? [])[1] ?? NaN);
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  mkdirSync('test-results/cannon', { recursive: true });
  const errors = [];
  // ---- part 1: the bot
  let page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => { errors.push(e.message); console.log('PAGEERROR', e.message.slice(0, 200)); });
  await page.goto(`${url}&bot=ideal`);
  await page.waitForSelector('#debugbtn', { timeout: 60000 });
  let sawLoaded = false, sawShot = false, cleared = false;
  for (let i = 0; i < Number(process.env.SECONDS ?? 90) * 4 && !cleared; i++) {
    await page.waitForTimeout(250);
    const body = await page.textContent('body');
    if (/Cannon loaded/.test(body) && !sawLoaded) { sawLoaded = true; await page.screenshot({ path: 'test-results/cannon/loaded.png' }); }
    if (/Shot! The ball flies back/.test(body) && !sawShot) { sawShot = true; await page.screenshot({ path: 'test-results/cannon/shot.png' }); }
    cleared = /You made it/.test(body);
  }
  await page.screenshot({ path: 'test-results/cannon/end.png' });
  await page.close();
  // ---- part 2: a player aims
  page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => { errors.push(e.message); console.log('PAGEERROR', e.message.slice(0, 200)); });
  await page.goto(url);
  await page.waitForSelector('#debugbtn', { timeout: 60000 });
  await page.keyboard.down('ArrowRight');
  let hint = '';
  for (let i = 0; i < 120 && !/Cannon loaded/.test(hint); i++) { await page.waitForTimeout(100); hint = await page.textContent('body'); }
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(600);
  const before = aimOf(await page.textContent('body'));
  await page.keyboard.down('ArrowDown'); await page.waitForTimeout(1800); await page.keyboard.up('ArrowDown');
  await page.waitForTimeout(400);
  const lower = aimOf(await page.textContent('body'));
  await page.screenshot({ path: 'test-results/cannon/aimed-low.png' });
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(2500); await page.keyboard.up('ArrowUp');
  await page.waitForTimeout(400);
  const higher = aimOf(await page.textContent('body'));
  await page.screenshot({ path: 'test-results/cannon/aimed-high.png' });
  const checks = { sawLoaded, sawShot, cleared, aimBefore: before, aimAfterDown: lower, aimAfterUp: higher, aimChanges: lower < before && higher > lower };
  console.log(checks, 'errors:', errors);
  await browser.close();
  process.exit(sawShot && cleared && checks.aimChanges && !errors.length ? 0 : 1);
} finally { server.kill(); }
