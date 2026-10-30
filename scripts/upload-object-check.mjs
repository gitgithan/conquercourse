// Browser check for the photo -> 3D object path (CC-221) with the server answers stubbed: dialog, box, progress, failure and retry, placement, credit lines.
// Run: PORT=5199 node scripts/upload-object-check.mjs   (the real server path is checked by hand: docs/pipelines.md, section 12)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const checks = {};
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 200)));
  const glb = readFileSync('public/assets/objects/bench-concrete.glb').toString('base64');
  let polls = 0, submits = 0;
  await page.route('**/api/object-lift', async (route) => {
    const b = JSON.parse(route.request().postData());
    if (b.action === 'submit') {
      submits++;
      if (submits === 1) return route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'down' }) });
      checks.sentBoxAndLabel = Array.isArray(b.box) && b.box.length === 4 && b.label === 'bench' && b.width > 0 && b.image.startsWith('data:image/jpeg');
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: 'fc-ABCDEFGHIJKL', moderation: 'ok:none' }) });
    }
    polls++;
    const body = polls < 2 ? { state: 'running' } : { state: 'done', glb, mesh: { height_m: 0.8 }, privacy: { people: 1 }, retry: { note: 'pad', padded: true }, seconds: {} };
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  });
  mkdirSync('test-results/upload-object', { recursive: true });
  await page.goto(`http://localhost:${port}/?mode=editor&uploadobj=1`);
  await page.waitForSelector('#makeobj', { state: 'attached', timeout: 120000 });
  checks.buttonBehindSwitch = true;
  await page.$eval('#makeobj', (e) => e.click());
  await page.setInputFiles('#pofile', 'public/assets/park/park01.jpg');
  const img = page.locator('#photoobj img');
  await img.waitFor({ timeout: 40000 });
  const r = await img.boundingBox();
  await page.mouse.move(r.x + r.width * 0.3, r.y + r.height * 0.25); await page.mouse.down();
  await page.mouse.move(r.x + r.width * 0.65, r.y + r.height * 0.6, { steps: 6 }); await page.mouse.up();
  await page.fill('#polabel', 'bench');
  checks.makeEnabledAfterBoxAndLabel = !(await page.locator('#pogo').isDisabled());
  await page.screenshot({ path: 'test-results/upload-object/1-dialog.png' });
  await page.click('#pogo');
  await page.waitForSelector('#poretry:not([hidden])', { timeout: 15000 });
  checks.plainFailureAndRetry = /not answering|try again/i.test(await page.textContent('#pomsg'));
  await page.screenshot({ path: 'test-results/upload-object/2-failure.png' });
  await page.click('#poretry');
  await page.waitForFunction(() => /Done in/.test(document.querySelector('#pomsg')?.textContent ?? ''), null, { timeout: 40000 });
  const done = await page.textContent('#pomsg');
  checks.padNoteAndBlurShown = /room around it/.test(done) && /blurred/.test(done);
  await page.screenshot({ path: 'test-results/upload-object/3-done.png' });
  await page.waitForSelector('#photoobj', { state: 'detached', timeout: 10000 });
  await page.waitForFunction(() => /Mine|Bench/.test(document.querySelector('#panel')?.textContent ?? ''), null, { timeout: 10000 });
  checks.creditForOwnPhoto = /From your own photo/.test(await page.textContent('#credit'));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/upload-object/4-placed-credit.png' });
  // a library object shows its photo credit
  await page.click('#addpiece'); await page.$eval('button[data-object=bench-concrete]', (e) => e.click());
  await page.waitForFunction(() => /Photo by/.test(document.querySelector('#credit')?.textContent ?? ''), null, { timeout: 15000 });
  checks.libraryCredit = /Rick Obst/.test(await page.textContent('#credit'));
  await page.screenshot({ path: 'test-results/upload-object/5-library-credit.png' });
  // without the switch there is no button
  await page.goto(`http://localhost:${port}/?mode=editor`);
  await page.waitForSelector('button[data-object=bench-concrete]', { state: 'attached', timeout: 30000 });
  checks.noButtonWithoutSwitch = (await page.locator('#makeobj').count()) === 0;
  await browser.close();
} finally { server.kill(); }
console.log(JSON.stringify(checks, null, 1));
process.exit(Object.values(checks).length >= 8 && Object.values(checks).every(Boolean) ? 0 : 1);
