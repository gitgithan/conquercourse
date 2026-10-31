// CC-243: pick a ready-made course in the editor: the pieces on the screen must change. Shot at 1280 x 720.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5199', out = process.argv[2] ?? 'test-results/preset'; mkdirSync(out, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
try {
  await new Promise((r) => setTimeout(r, 5000));
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  page.on('dialog', (d) => d.accept());
  const errs = []; page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
  await page.goto(`http://localhost:${port}/?mode=editor&welcome=0`);
  await page.waitForSelector('#presetpick', { timeout: 90000 });
  await page.waitForTimeout(4000);
  const state = () => page.evaluate(() => ({ pieces: document.documentElement.dataset.pieces, sel: document.querySelector('#presetpick').value, saved: (JSON.parse(localStorage.getItem('cc.editor.world') ?? localStorage.getItem(Object.keys(localStorage).find((k) => /editor/.test(k)) ?? '') ?? '{}').pieces ?? []).map((p) => p.src).join(',') }));
  console.log('start', JSON.stringify(await state()));
  await page.screenshot({ path: `${out}/0-start.png` });
  for (const id of ['coaster', 'failing', 'swing']) {
    await Promise.all([page.waitForNavigation({ timeout: 60000 }).catch(() => {}), page.selectOption('#presetpick', id)]);
    await page.waitForSelector('#presetpick', { timeout: 90000 }); await page.waitForTimeout(6000);
    console.log(id, JSON.stringify(await state()));
    await page.screenshot({ path: `${out}/${id}.png` });
  }
  await page.click('#play'); await page.waitForTimeout(25000);
  await page.screenshot({ path: `${out}/course-start.png` });
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(3500);
  await page.screenshot({ path: `${out}/course-run.png` });
  await page.keyboard.up('ArrowRight');
  console.log('errors', JSON.stringify(errs));
  await browser.close();
} finally { server.kill(); }
