// CC-244: the Coaster piece in the editor: add three sections and a bar, show the side view and the proof line. Shot at 1280 x 720.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5199', out = process.argv[2] ?? 'test-results/coaster';
mkdirSync(out, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const errors = [];
try {
  await new Promise((r) => setTimeout(r, 5000));
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 120)));
  await page.goto(`http://localhost:${port}/?mode=editor&welcome=0`);
  await page.waitForSelector('#addpiece', { timeout: 90000 });
  await page.waitForTimeout(3000);
  if (await page.isVisible('#edglossary')) await page.click('#glossaryhide');
  // an empty world: delete the starter pieces by clicking each and pressing Delete
  for (let i = 0; i < 12 && Number(await page.evaluate(() => document.documentElement.dataset.pieces)) > 0; i++) {
    const list = await page.evaluate(() => window.ccPieceScreen?.() ?? []);
    if (!list.length) break;
    await page.mouse.click(list[0].x, list[0].y); await page.keyboard.press('Delete'); await page.waitForTimeout(300);
  }
  console.log('after delete', await page.evaluate(() => document.documentElement.dataset.pieces));
  await page.click('#addpiece');
  for (const shape of ['start', 'dip', 'glide']) { await page.$eval('#trackshape', (e, v) => { e.value = v; }, shape); await page.$eval('#addcoaster', (e) => e.click()); await page.waitForTimeout(400); }
  await page.click('#addpiece').catch(() => {}); await page.keyboard.press('Escape');
  await page.click('#viewmode');
  await page.keyboard.press('KeyF');
  await page.waitForTimeout(12000);
  console.log('proof', (await page.evaluate(() => document.body.innerText)).split('\n').filter((l) => /simulator|clear|ride|coaster/i.test(l)).slice(0, 6).join(' | '));
  console.log('pieces', await page.evaluate(() => document.documentElement.dataset.pieces));
  await page.screenshot({ path: `${out}/coaster-editor-1280.png` });
  console.log('errors', JSON.stringify(errors));
  await browser.close();
} finally { server.kill(); }
