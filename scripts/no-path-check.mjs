// CC-211 in the browser at 1280 px: the slicing screen has no "Real hills" or "Use a ready place" box, lists only places with a path,
// opens the editor only after a proved lane, and the old screen (?slice2=old) is unchanged. Run on the VM: PORT=5295 node scripts/no-path-check.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const port = process.env.PORT ?? '5295', out = 'data/eval/no-path', shots = `${out}/shots`;
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const checks = {}, notes = [];
mkdirSync(shots, { recursive: true });
const base = `http://localhost:${port}/?mode=map&hooks=1&flight=0`;
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => notes.push('PAGEERROR ' + e.message.slice(0, 200)));
  const open = async (q) => { await page.goto(base + q); await page.waitForSelector('#ready .card, #ready button', { state: 'attached', timeout: 60000 }); };
  const count = () => page.$$eval('#ready button[data-slug]', (c) => c.length);
  await open('');
  checks.noHillsBox = (await page.$('#hills')) === null; checks.noReadyBox = (await page.$('#useready')) === null;
  const normal = await count(); notes.push(`normal list: ${normal}`);
  await page.screenshot({ path: `${shots}/new-screen.png` });
  await open('&places=all'); checks.placesAllIgnored = (await count()) === normal;
  await open('&places=all&debug=places'); const dbg = await count(); checks.debugShowsMore = dbg >= normal; notes.push(`debug list: ${dbg}`);
  await open('&slice2=old'); checks.oldScreenKeepsBoxes = (await page.$('#hills')) !== null && (await page.$('#useready')) !== null;
  await page.screenshot({ path: `${shots}/old-screen.png` });
  // a ready place with a path: Build shows the editor button
  await open('');
  await page.click('button[data-slug="montmartre-paris"]');
  await page.waitForFunction(() => !!document.documentElement.dataset.pin, null, { timeout: 20000 });
  await page.click('#build');
  await page.waitForFunction(() => document.documentElement.dataset.lanePhase === 'done', null, { timeout: 120000 });
  checks.editorButtonAfterProof = await page.$eval('#openeditor', (b) => !b.hidden);
  checks.ground = await page.evaluate(() => document.documentElement.dataset.hill);
  checks.pieceStored = await page.evaluate(() => !!sessionStorage.getItem('cc.map.piece') || Object.keys(sessionStorage).length > 0);
  await page.screenshot({ path: `${shots}/build-montmartre.png` });
  // a pin where the buildings give no lane: the reason and the suggestions, no button
  await open('&lat=40.7484&lon=-73.9857&z=16');
  await page.click('#map canvas', { position: { x: 400, y: 300 } });
  await page.waitForFunction(() => !!document.documentElement.dataset.pin, null, { timeout: 20000 });
  notes.push('pin ' + await page.evaluate(() => document.documentElement.dataset.pin));
  await page.screenshot({ path: `${shots}/pin.png` });
  writeFileSync(`${out}/browser-check.json`, JSON.stringify({ checks, notes }, null, 2) + '\n');
  console.log(JSON.stringify({ checks, notes }, null, 2));
  await browser.close();
} finally { server.kill(); }
