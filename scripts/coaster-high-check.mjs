// CC-244: coaster dots at extreme heights stay on the black line, the side view fits every dot, and the top is named. 1280 x 720.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5197', out = process.argv[2] ?? 'test-results/coaster-high'; mkdirSync(out, { recursive: true });
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
  const ds = async (k) => JSON.parse(await page.evaluate((k) => document.documentElement.dataset[k] || '[]', k));
  const gap = async () => { const d = await ds('dotPx'), l = await ds('lineGap'); return { d, worst: Math.max(0, ...l) }; };
  const dragTo = async (i, dy) => {
    const d = (await ds('dotPx'))[i]; const x = box.x + d[0], y = box.y + d[1];
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, y + dy / 2, { steps: 5 }); await page.mouse.move(x, y + dy, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(2000);
  };
  const state = () => page.evaluate(() => { const w = JSON.parse(localStorage.getItem('cc.world.v1')); return { pieces: w.pieces.map((p) => ({ src: p.src.slice(0, 80), y: p.y })), level: w.level }; });
  const topM = async () => Math.max(...(await ds('dotM')));
  const shot = (n) => page.locator('#profile').screenshot({ path: `${out}/${n}.png` });
  // 1. very high: drag dot 1 up again and again (the side view scales to fit), past the old 14 m top, to 50 m and on to the ceiling
  let k = 0; while ((await topM()) < 50 && k++ < 45) await dragTo(1, -Math.max(30, (await ds('dotPx'))[1][1] - 24));
  const m50 = await topM(); console.log('highest dot', m50.toFixed(1), 'm after', k, 'drags');
  ok('a dot goes past the old 14 m top', m50 > 14); ok('a dot reaches 50 m', m50 >= 50);
  { const g = await gap(); console.log('worst gap', g.worst.toFixed(2), 'dots px', JSON.stringify(g.d.map((p) => p.map(Math.round)))); ok('at 50 m: every dot on the line (steep slopes: a 0.1 m cell is up to 3% of the height)', g.worst < 0.3 + 0.03 * m50); ok('at 50 m: every dot inside the picture', g.d.every((p) => p[1] > 18 && p[1] < 706)); }
  ok('no "highest point" note below the safety ceiling', (await page.evaluate(() => document.documentElement.dataset.topNote || '')) === '');
  await shot('high-50m');
  // 2. below the ground: drag the lowest dot (3) down, then the whole section down
  for (let j = 0; j < 3; j++) await dragTo(3, 120);
  console.log('after dragging the lowest dot down', JSON.stringify(await state()), 'lowest dot m', Math.min(...(await ds('dotM'))).toFixed(2));
  await shot('lowest-dot-down');
  await page.evaluate(() => { const w = JSON.parse(localStorage.getItem('cc.world.v1')); w.pieces.forEach((p) => { if (p.src.startsWith('track:')) p.y -= 3; }); localStorage.setItem('cc.world.v1', JSON.stringify(w)); });
  await page.reload(); await page.waitForSelector('#profile', { timeout: 90000 }); await page.waitForTimeout(6000);
  console.log('section 3 m down', JSON.stringify(await state()), 'lowest dot m', Math.min(...(await ds('dotM'))).toFixed(2), 'line gap', (await gap()).worst.toFixed(2));
  await shot('section-3m-down');
  console.log('errors', JSON.stringify(errs)); ok('no page errors', errs.length === 0);
  await browser.close();
} finally { server.kill(); }
process.exit(bad ? 1 : 0);
