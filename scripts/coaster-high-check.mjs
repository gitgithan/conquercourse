// CC-244: coaster points have no design top, the floor (lane level) blocks going lower, the curve never goes underground, and a blocked drag says why. 1280 x 720, World Editor and Coaster builder.
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
  const attr = (k) => page.evaluate((k) => document.documentElement.dataset[k] || '', k);
  const cursor = () => page.evaluate(() => document.getElementById('profile').style.cursor);
  const shot = (n) => page.locator('#profile').screenshot({ path: `${out}/${n}.png` });
  const press = async (i) => { const d = (await ds('dotPx'))[i]; await page.mouse.move(box.x + d[0], box.y + d[1]); await page.mouse.down(); return d; };
  const dragTo = async (i, dx, dy) => { const d = await press(i); const x = box.x + d[0], y = box.y + d[1]; await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 5 }); await page.mouse.move(x + dx, y + dy, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(1500); };
  const worst = async () => Math.max(0, ...(await ds('lineGap')));
  await shot('start');
  // 1. no design top: up to 300 m and past it
  let k = 0; while (Math.max(...(await ds('dotM'))) < 300 && k++ < 40) await dragTo(1, 0, -Math.max(30, (await ds('dotPx'))[1][1] - 24));
  const top = Math.max(...(await ds('dotM'))); console.log('highest dot', top.toFixed(0), 'm after', k, 'drags');
  ok('a dot goes to 300 m', top >= 300);
  ok('at 300 m: every dot on the line', (await worst()) < 0.3 + 0.03 * top);
  ok('no "highest point" label below the 1000 m safety value', (await attr('dotBlock')) === '');
  await shot('high-300m');
  // 2. the floor: drag the lowest dot (3) far under the ground
  let d = await press(3); await page.mouse.move(box.x + d[0], box.y + d[1] + 40, { steps: 6 });
  ok('floor: the dot stops at ground level (label "floor")', (await attr('dotBlock')) === 'floor');
  ok('floor: cursor is not-allowed', (await cursor()) === 'not-allowed');
  await shot('floor-blocked');
  await page.mouse.up(); await page.waitForTimeout(800);
  ok('floor: label gone after release', (await attr('dotBlock')) === '');
  ok('floor: no dot under the lane level', Math.min(...(await ds('dotM'))) >= -0.001);
  // 3. the curve is never underground and still curved
  ok('curve stays on the dots', (await worst()) < 0.3 + 0.03 * top);
  await shot('curve-after');
  // 4. too close to the next dot
  d = await press(2); await page.mouse.move(box.x + d[0] + 200, box.y + d[1], { steps: 8 });
  ok('spacing: label "spacing" when pushed onto the next dot', (await attr('dotBlock')) === 'spacing');
  await shot('spacing-blocked'); await page.mouse.up(); await page.waitForTimeout(500);
  // 5. adding a dot under the ground is held at the ground and says so
  const dd = await ds('dotPx'); await page.mouse.dblclick(box.x + (dd[0][0] + dd[1][0]) / 2, box.y + 281); await page.waitForTimeout(1200);
  ok('adding under the ground: held at ground level, with a note', Math.min(...(await ds('dotM'))) >= -0.001 && (await attr('dotFlash')).includes('ground level'));
  await shot('add-under-ground');
  // 6. the Coaster builder
  await page.goto(`http://localhost:${port}/?mode=coaster`); await page.waitForSelector('#cocanvas', { timeout: 60000 }); await page.waitForTimeout(1500);
  const cb = await page.locator('#cocanvas').boundingBox(), kk = cb.width / 1100;
  const bd = async () => JSON.parse(await page.evaluate(() => document.documentElement.dataset.coDots || '[]'));
  let p = (await bd())[1]; await page.mouse.move(cb.x + p[0] * kk, cb.y + p[1] * kk); await page.mouse.down(); await page.mouse.move(cb.x + p[0] * kk, cb.y + (p[1] + 400) * kk, { steps: 10 });
  ok('builder: blocked at the floor says so', (await attr('dotBlock')).includes('ground level'));
  ok('builder: cursor is not-allowed', (await page.evaluate(() => document.getElementById('cocanvas').style.cursor)) === 'not-allowed');
  await page.locator('#cocanvas').screenshot({ path: `${out}/builder-floor-blocked.png` });
  await page.mouse.up(); await page.waitForTimeout(300);
  ok('builder: label gone after release', (await attr('dotBlock')) === '');
  ok('builder: no point under 0', (await bd()).every((q) => q[1] <= 410.5));
  console.log('errors', JSON.stringify(errs)); ok('no page errors', errs.length === 0);
  await browser.close();
} finally { server.kill(); }
process.exit(bad ? 1 : 0);
