// CC-177: the World editor's camera (wheel zooms toward the cursor, pan really moves, Fit frames the pieces), the Fix menu, the glossary and ?editorui=old.
// BASE=<dir> runs only the camera probe (no UI checks), for measuring an older tree.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? String(5300 + Math.floor(Math.random() * 600)), out = process.env.OUT ?? 'data/eval/cc-editor-ux';
const probeOnly = process.env.PROBE_ONLY === '1';
mkdirSync(out, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const checks = {}, errors = [], log = {};
try {
  await new Promise((r) => setTimeout(r, 5000));
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); page.setDefaultTimeout(300000); // software GL is slow
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 100)));
  const url = `http://localhost:${port}/?mode=editor&welcome=0`;
  const cam = async () => JSON.parse(await page.evaluate(() => document.documentElement.dataset.cam));
  const settle = () => page.waitForTimeout(500);
  await page.goto(url);
  await page.waitForSelector('#view3d', { timeout: 90000 });
  await page.waitForFunction(() => Number(document.documentElement.dataset.pieces) >= 3, null, { timeout: 90000 });
  await page.waitForTimeout(3000);
  if (!probeOnly) {
    await page.screenshot({ path: `${out}/new-first-visit.png` });
    checks['first visit: glossary is showing'] = await page.isVisible('#edglossary');
    await page.click('#glossaryhide');
    checks['Hide closes the glossary'] = !(await page.isVisible('#edglossary'));
    await page.click('#glossarybtn');
    checks['? brings it back'] = await page.isVisible('#edglossary');
    await page.click('#glossaryhide'); await page.reload(); await page.waitForSelector('#view3d', { timeout: 90000 }); await page.waitForSelector('#fixmenubtn', { state: 'attached', timeout: 90000 }); await page.waitForFunction(() => (document.documentElement.dataset.verdict ?? '') !== '', null, { timeout: 240000 }); await page.waitForTimeout(2500); // the proof search keeps the page busy until it answers
    checks['hidden choice is remembered after a reload'] = !(await page.isVisible('#edglossary'));
    await page.click('#fixmenubtn'); await page.waitForTimeout(200);
    checks['Fix menu lists 4 actions'] = (await page.locator('#fixmenu button').count()) === 4;
    await page.screenshot({ path: `${out}/new-fix-menu.png` });
    await page.click('#fixmenu-fixit'); await page.waitForTimeout(800);
    checks['Fix it from the menu opens the design partner'] = await page.isVisible('#helper');
    await page.screenshot({ path: `${out}/new-fix-it-pressed.png` });
    await page.keyboard.press('Escape');
    for (const id of ['easier', 'findroutes', 'what']) {
      const before = errors.length;
      await page.click('#fixmenubtn'); await page.waitForTimeout(200);
      await page.click(`#fixmenu-${id}`); await page.waitForTimeout(1500);
      checks[`Fix menu: ${id} runs without page errors`] = errors.length === before && await page.isVisible('#helper');
      await page.keyboard.press('Escape');
    }
  }
  const box = await page.locator('#view3d').boundingBox();
  const cx = box.x + box.width * Number(process.env.CURX ?? 0.3), cy = box.y + box.height * 0.5;
  const c0 = await cam(); log.start = c0;
  await page.mouse.move(cx, cy);
  for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, -100); await page.waitForTimeout(80); }
  await settle(); const c1 = await cam(); log.afterWheel8 = c1;
  checks['wheel: 8 notches bring the camera at least 40% closer'] = c1.d < c0.d * 0.6;
  checks['wheel: zooms toward the cursor (the look-at point moves)'] = Math.abs(c1.t[0] - c0.t[0]) > 0.5;
  for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 100); await page.waitForTimeout(80); }
  await settle(); const c2 = await cam(); log.afterWheelBack = c2;
  checks['wheel: zooming out works'] = c2.d > c1.d * 1.5;
  await page.mouse.move(cx, cy); await page.mouse.down({ button: 'right' }); await page.mouse.move(cx - 300, cy, { steps: 12 }); await page.mouse.up({ button: 'right' }); await settle();
  const c3 = await cam(); log.afterRightPan = c3;
  checks['pan: a 300 px right-drag moves the look-at point by at least 3 m'] = Math.hypot(c3.t[0] - c2.t[0], c3.t[2] - c2.t[2]) > 3;
  await page.mouse.move(cx, cy); await page.mouse.down({ button: 'middle' }); await page.mouse.move(cx, cy + 150, { steps: 8 }); await page.mouse.up({ button: 'middle' }); await settle();
  const c4 = await cam(); log.afterMiddlePan = c4;
  checks['pan: middle-drag moves the view too'] = Math.hypot(c4.t[0] - c3.t[0], c4.t[2] - c3.t[2]) > 1;
  if (!probeOnly) {
    await page.keyboard.press('f'); await page.waitForTimeout(1200);
    const c5 = await cam(); log.afterFitKey = c5;
    checks['Fit (key F) moves the camera to the pieces (look-at x between 0 and 40 m)'] = c5.t[0] > 0 && c5.t[0] < 40 && Math.abs(c5.t[2]) < 8;
    await page.screenshot({ path: `${out}/new-after-fit.png` });
    await page.mouse.move(cx, cy); for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, -100); await page.waitForTimeout(50); }
    await settle(); await page.mouse.down({ button: 'right' }); await page.mouse.move(cx + 400, cy, { steps: 8 }); await page.mouse.up({ button: 'right' }); await settle();
    const c6 = await cam();
    await page.click('#fitview'); await page.waitForTimeout(1200);
    const c7 = await cam(); log.afterFitButton = [c6, c7];
    checks['Fit button brings it back after zoom and pan'] = Math.abs(c7.t[0] - c5.t[0]) < 1 && Math.abs(c7.d - c5.d) < 1;
    await page.screenshot({ path: `${out}/new-layout.png` });
    await page.goto(url + '&editorui=old'); await page.waitForSelector('#view3d'); await page.waitForTimeout(3500);
    checks['?editorui=old: no Fix menu, no glossary'] = !(await page.locator('#fixmenubtn').count()) && !(await page.locator('#edglossary').count());
    await page.screenshot({ path: `${out}/old-layout.png` });
  }
  await browser.close();
} finally { server.kill(); }
const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
console.log(JSON.stringify(log), JSON.stringify(checks, null, 2), '\nerrors', errors);
console.log(failed.length || errors.length ? `FAIL: ${failed.join('; ')}` : 'PASS');
process.exit(failed.length || errors.length ? 1 : 0);
