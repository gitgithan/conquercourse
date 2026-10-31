// CC-244: coaster dots in the editor's side view can be dragged again and again; the hand cursor shows over a dot every time. 1280 x 720.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5198', out = process.argv[2] ?? 'test-results/coaster-drag-twice'; mkdirSync(out, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
let bad = 0; const ok = (name, v) => { console.log(v ? 'PASS' : 'FAIL', name); if (!v) bad++; };
try {
  await new Promise((r) => setTimeout(r, 5000));
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  page.on('dialog', (d) => d.accept());
  const errs = []; page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
  await page.goto(`http://localhost:${port}/?mode=editor&welcome=0`);
  await page.waitForSelector('#presetpick', { timeout: 90000 }); await page.waitForTimeout(3000);
  await Promise.all([page.waitForNavigation({ timeout: 60000 }).catch(() => {}), page.selectOption('#presetpick', 'coaster')]);
  await page.waitForSelector('#presetpick', { timeout: 90000 }); await page.waitForTimeout(6000);
  const box = await page.locator('#profile').boundingBox();
  const dots = async () => JSON.parse(await page.evaluate(() => document.documentElement.dataset.dotPx || '[]'));
  const cursor = () => page.evaluate(() => document.getElementById('profile').style.cursor);
  const drag = async (i, dx, dy) => {
    const d = (await dots())[i]; const x = box.x + d[0], y = box.y + d[1];
    await page.mouse.move(x, y); await page.waitForTimeout(150); const cur = await cursor(), top = await page.evaluate(([a, b]) => { const e = document.elementFromPoint(a, b); return e ? (e.id || e.tagName) : 'none'; }, [x, y]); if (top !== 'profile') console.log('COVERED by', top);
    await page.mouse.down(); await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 4 }); await page.mouse.move(x + dx, y + dy, { steps: 4 }); await page.mouse.up();
    await page.waitForTimeout(Number(process.env.WAIT ?? 2500));
    return { cur, before: d, after: (await dots())[i] };
  };
  const n0 = (await dots()).length; ok(`dots showing at start (${n0})`, n0 >= 3);
  const moved = (r) => r.after && (Math.abs(r.after[0] - r.before[0]) > 3 || Math.abs(r.after[1] - r.before[1]) > 3);
  for (let k = 1; k <= 3; k++) { const r = await drag(1, k % 2 ? 25 : -20, k % 2 ? -25 : 20); ok(`drag ${k} of dot 1: cursor grab (${r.cur}), moved`, r.cur === 'grab' && moved(r)); }
  // the owner's bug: turning the camera (a press on the 3D picture) clears the chosen piece and the dots used to die with it
  const view = await page.locator('#plan').locator('xpath=..').boundingBox();
  await page.mouse.move(view.x + 40, view.y + 40); await page.mouse.down(); await page.mouse.move(view.x + 120, view.y + 70, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(800);
  const r1b = await drag(1, 18, 18); ok(`after turning the camera: cursor ${r1b.cur}, dot still moves`, r1b.cur === 'grab' && moved(r1b));
  const r2 = await drag(2, 20, 20); ok(`drag of dot 2: cursor ${r2.cur}, moved`, r2.cur === 'grab' && moved(r2));
  const before = (await dots()).length; const d0 = (await dots())[0], d1 = (await dots())[1];
  await page.mouse.dblclick(box.x + (d0[0] + d1[0]) / 2, box.y + (d0[1] + d1[1]) / 2 - 6); await page.waitForTimeout(2500);
  ok(`double-click still adds a dot (${before} -> ${(await dots()).length})`, (await dots()).length === before + 1);
  await page.screenshot({ path: `${out}/after.png` });
  console.log('errors', JSON.stringify(errs)); ok('no page errors', errs.length === 0);
  await browser.close();
} finally { server.kill(); }
process.exit(bad ? 1 : 0);
