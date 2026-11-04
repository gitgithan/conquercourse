// CC-133: screenshots of the Timeline tunnel at the start, the middle and the stage (1280x720), a no-freeze check while walking, and the picker card picture.
//   node scripts/timeline-shots.mjs [outdir]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';

const out = process.argv[2] ?? 'test-results/timeline';
const port = process.env.PORT ?? '5183';
mkdirSync(out, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const url = (q) => `http://localhost:${port}/making-of/timeline.html${q}`;
try {
  await new Promise((r) => setTimeout(r, 4000));
  const browser = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const models = (n) => page.waitForFunction((n) => { const w = window.CCWalk; return w && w.pip && w.juno && w.crew.filter(Boolean).length >= n; }, n, { timeout: 240000 }); // the 3D walkers have loaded
  const shot = async (name) => { await page.screenshot({ path: `${out}/${name}.png` }); };
  await page.goto(url('')); await models(0); await page.waitForTimeout(800);
  await shot('1-start');
  await page.goto(url('?at=0.06')); await models(0); await page.waitForTimeout(500);
  await page.keyboard.down('w'); await page.waitForTimeout(700); await shot('2-mid'); await page.keyboard.up('w');
  await page.goto(url('?gate=5')); await models(0); await page.waitForTimeout(900);
  await shot('2b-day-gate');
  await page.goto(url('?at=1')); await models(8); await page.waitForTimeout(2500);
  await shot('3-stage');
  await page.goto(url('?at=0.3')); await models(0); await page.waitForTimeout(600);
  await page.locator('.card').nth(12).focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(500);
  await shot('panel');
  await page.keyboard.press('Escape');
  // no-freeze check: hold W from the start and compare a picture every 120 ms
  await page.goto(url('')); await page.waitForTimeout(800);
  await page.keyboard.down('w');
  const hashes = [];
  for (let i = 0; i < 40; i++) { const b = await page.screenshot({ type: 'jpeg', quality: 40 }); hashes.push(createHash('md5').update(b).digest('hex')); await page.waitForTimeout(120); }
  await page.keyboard.up('w');
  let run = 1, worst = 1;
  for (let i = 1; i < hashes.length; i++) { run = hashes[i] === hashes[i - 1] ? run + 1 : 1; worst = Math.max(worst, run); }
  const pos = await page.evaluate(() => document.querySelector('#bar i').style.width);
  writeFileSync(`${out}/walk-check.json`, JSON.stringify({ frames: hashes.length, distinct: new Set(hashes).size, longest_identical_run: worst, progress_after: pos }, null, 2) + '\n');
  // the picker card picture, 640x360 WebP, from the middle shot
  await page.goto(url('?at=0.45&music=0')); await page.waitForTimeout(600);
  const b64 = (await page.screenshot({ type: 'png' })).toString('base64');
  const webp = await page.evaluate(async (data) => {
    const img = new Image(); img.src = `data:image/png;base64,${data}`; await img.decode();
    const c = document.createElement('canvas'); c.width = 640; c.height = 360;
    c.getContext('2d').drawImage(img, 0, 0, 640, 360);
    return c.toDataURL('image/webp', 0.7).split(',')[1];
  }, b64);
  writeFileSync(`${out}/making-timeline.webp`, Buffer.from(webp, 'base64'));
  await browser.close();
} finally { server.kill(); }
