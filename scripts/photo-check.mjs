// Walks the photo-to-course labs button in the editor with real saved model answers (no key needed): a draft that clears, one Fix it must repair, and a bad answer.
// Run on the VM: node scripts/photo-check.mjs   (screenshots in test-results/photo/)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const saved = (id) => JSON.parse(readFileSync(`data/eval/photo-course/outputs/${id}.run1.json`, 'utf8')).reply;
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  const errors = []; page.on('pageerror', (e) => { errors.push(e.message); console.log('PAGEERROR', e.message.slice(0, 200)); });
  mkdirSync('test-results/photo', { recursive: true });
  const checks = {};
  let answer = saved('new03'), calls = 0;
  await page.route('**/api/photo-course', (route) => { calls++; route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reply: answer }) }); });
  await page.goto(`http://localhost:${port}/?mode=editor`);
  await page.waitForSelector('#view3d', { timeout: 60000 });
  checks.buttonHiddenWithoutLabs = (await page.$('#photobtn')) === null;
  const state = () => page.evaluate(() => document.documentElement.dataset.photoDraft);
  const pick = async () => { await page.evaluate(() => { delete document.documentElement.dataset.photoDraft; document.getElementById('photofile').value = ''; }); await page.setInputFiles('#photofile', 'public/assets/park/park01.jpg'); };
  const settled = () => page.waitForFunction(() => ['cleared', 'fixed', 'unfixed', 'unreadable', 'error'].includes(document.documentElement.dataset.photoDraft), null, { timeout: 150000 });
  await page.goto(`http://localhost:${port}/?mode=editor&labs=1`);
  await page.waitForSelector('#photobtn', { timeout: 60000 });
  checks.buttonShownWithLabs = true;
  // 1. three bars (new03): a draft arrives as pieces and the simulator proves it
  await pick(); await settled();
  checks.barsDraft = await state();
  checks.barsDraftHasPieces = Number(await page.evaluate(() => document.documentElement.dataset.pieces)) >= 5;
  await page.screenshot({ path: 'test-results/photo/1-bars-draft.png' });
  // 2. a skatepark answer with stray bars (new02): not clearable as drawn, Fix it or taking the bars out must give a clearable lane
  answer = saved('new02'); await pick(); await settled();
  checks.skateDraft = await state();
  await page.waitForTimeout(1500);
  checks.skateEndsClearable = /The simulator can clear/.test(await page.textContent('#verdict'));
  await page.screenshot({ path: 'test-results/photo/2-skate-draft-fixed.png' });
  // 3. an answer with no layout in it: nothing changes and the helper says so
  const before = await page.evaluate(() => document.documentElement.dataset.pieces);
  answer = 'I see a park.'; await pick(); await settled();
  checks.badAnswer = await state();
  checks.badAnswerKeepsWorld = (await page.evaluate(() => document.documentElement.dataset.pieces)) === before;
  checks.badAnswerSaysSo = /could not read a layout/.test(await page.textContent('#reply'));
  // 4. the draft survives a reload (boxes keep their size in the saved world)
  answer = saved('new03'); await pick(); await settled();
  const n = await page.evaluate(() => document.documentElement.dataset.pieces);
  await page.reload(); await page.waitForSelector('#view3d', { timeout: 60000 });
  await page.waitForFunction((k) => document.documentElement.dataset.pieces === k, n, { timeout: 30000 });
  checks.draftSurvivesReload = true;
  checks.modelCalledOncePerPhoto = calls === 4;
  checks.noPageErrors = errors.length === 0;
  console.log(JSON.stringify(checks, null, 2));
  await browser.close();
  const bad = Object.entries(checks).filter(([k, v]) => v === false || (k.endsWith('Draft') && !['cleared', 'fixed'].includes(v)) || (k === 'badAnswer' && v !== 'unreadable'));
  console.log(bad.length ? `FAILED: ${bad.map(([k]) => k).join(', ')}` : 'ALL OK');
  process.exitCode = bad.length ? 1 : 0;
} finally { server.kill(); }
