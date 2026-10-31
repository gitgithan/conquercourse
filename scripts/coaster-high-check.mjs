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
  for (let k = 1; k <= 8; k++) {
    const g0 = await gap(); await dragTo(1, -120);
    const g = await gap(); const tops = g.d.map((p) => p[1]);
    console.log(`drag ${k}: dots y px ${tops.map((t) => Math.round(t)).join(',')}, worst dot-to-line gap ${g.worst.toFixed(3)} m, note ${await page.evaluate(() => document.documentElement.dataset.topNote || '-')}`);
    ok(`drag ${k}: every dot on the line`, g.worst < 0.3);
    ok(`drag ${k}: every dot inside the picture`, tops.every((t) => t > 18 && t < 706));
  }
  ok('the limit is named once reached', (await page.evaluate(() => document.documentElement.dataset.topNote || '')).includes('highest'));
  await page.locator('#profile').screenshot({ path: `${out}/high.png` });
  console.log('errors', JSON.stringify(errs)); ok('no page errors', errs.length === 0);
  await browser.close();
} finally { server.kill(); }
process.exit(bad ? 1 : 0);
