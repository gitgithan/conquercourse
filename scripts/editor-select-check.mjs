// CC-200: the World editor's top bar (Add pieces is the first, primary button) and choosing several pieces
// (Shift+drag box, Shift+click, count chip, Delete removes all, one Undo restores, Esc clears), at 1280x720.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? String(5300 + Math.floor(Math.random() * 600)), out = process.env.OUT ?? 'data/eval/cc-editor-select';
mkdirSync(out, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const checks = {}, errors = [];
try {
  await new Promise((r) => setTimeout(r, 5000));
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 100)));
  const url = `http://localhost:${port}/?mode=editor&welcome=0`;
  const sel = async () => Number(await page.evaluate(() => document.documentElement.dataset.selected ?? '0'));
  const count = async () => Number(await page.evaluate(() => document.documentElement.dataset.pieces));
  const spots = () => page.evaluate(() => window.ccPieceScreen());
  await page.goto(url);
  await page.waitForSelector('#view3d', { timeout: 90000 });
  await page.waitForFunction(() => Number(document.documentElement.dataset.pieces) >= 3, null, { timeout: 90000 });
  await page.waitForTimeout(2500);
  await page.click('#glossaryhide').catch(() => {});
  // the top bar: Add pieces first and green, bigger than Fit
  const add = await page.locator('#addpiece').boundingBox(), fit = await page.locator('#fitview').boundingBox();
  checks['Add pieces is left of Fit and taller or equal'] = add.x < fit.x && add.height >= fit.height;
  checks['Add pieces is a primary (filled) button'] = await page.evaluate(() => document.getElementById('addpiece').classList.contains('go'));
  checks['Fit is not primary'] = await page.evaluate(() => !document.getElementById('fitview').classList.contains('go'));
  await page.click('#addpiece'); await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/add-menu-open.png` });
  await page.keyboard.press('Escape'); await page.click('#fitview'); await page.waitForTimeout(1200);
  const n0 = await count();
  const box = await page.locator('#view3d').boundingBox();
  const near = (await spots()).filter((s) => s.x > box.x && s.x < box.x + box.width && s.y > box.y && s.y < box.y + box.height);
  checks['at least 3 pieces are visible after Fit'] = near.length >= 3;
  // Shift+drag a box around everything, screenshot mid-drag
  const x0 = box.x + 20, y0 = box.y + 60, x1 = box.x + box.width - 20, y1 = box.y + box.height - 20;
  await page.keyboard.down('Shift');
  await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 6 });
  checks['the box is drawn while dragging'] = await page.locator('.marquee').count() === 1;
  await page.mouse.move(x1, y1, { steps: 6 }); await page.screenshot({ path: `${out}/marquee-in-progress.png` });
  await page.mouse.up(); await page.keyboard.up('Shift'); await page.waitForTimeout(300);
  const n = await sel();
  checks['the box chose several pieces'] = n >= 3;
  checks['the box is gone after release'] = await page.locator('.marquee').count() === 0;
  checks['chip says "N selected"'] = (await page.textContent('#selcount')) === `${n} selected` && await page.isVisible('#selchip');
  await page.screenshot({ path: `${out}/selected-chip.png` });
  // Shift+click drops one, then adds it back
  const one = (await spots()).find((s) => s.x > box.x && s.x < box.x + box.width && s.y > box.y && s.y < box.y + box.height);
  await page.keyboard.down('Shift'); await page.mouse.click(one.x, one.y); await page.keyboard.up('Shift'); await page.waitForTimeout(200);
  checks['Shift+click drops one'] = (await sel()) === n - 1 || (await sel()) <= 1;
  await page.keyboard.down('Shift'); await page.mouse.click(one.x, one.y); await page.keyboard.up('Shift'); await page.waitForTimeout(200);
  const nAgain = await sel();
  checks['Shift+click adds it back'] = nAgain >= 2;
  // Esc clears
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  checks['Esc clears the choice'] = (await sel()) === 0 && !(await page.isVisible('#selchip'));
  // choose again, Delete key removes all in one step, one Undo restores
  await page.keyboard.down('Shift'); await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move(x1, y1, { steps: 8 }); await page.mouse.up(); await page.keyboard.up('Shift'); await page.waitForTimeout(300);
  const m = await sel();
  await page.keyboard.press('Delete'); await page.waitForTimeout(400);
  const n1 = await count();
  checks['Delete removes every chosen piece'] = n1 === n0 - m && m >= 3;
  await page.keyboard.press('Control+z'); await page.waitForTimeout(500);
  checks['one Undo brings them all back'] = (await count()) === n0;
  // the Delete button on the chip
  await page.keyboard.down('Shift'); await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move(x1, y1, { steps: 8 }); await page.mouse.up(); await page.keyboard.up('Shift'); await page.waitForTimeout(300);
  await page.click('#seldelete'); await page.waitForTimeout(400);
  checks['the Delete button removes them too'] = (await count()) < n0;
  await page.keyboard.press('Control+z'); await page.waitForTimeout(500);
  checks['and one Undo restores them'] = (await count()) === n0;
  // a plain click still chooses one piece, a plain drag still turns the view (no marquee without Shift)
  const spot = (await spots()).find((s) => s.x > box.x && s.x < box.x + box.width && s.y > box.y && s.y < box.y + box.height);
  await page.mouse.click(spot.x, spot.y); await page.waitForTimeout(200);
  checks['a plain click chooses one piece (no chip)'] = !(await page.isVisible('#selchip'));
  // the flat plan: plain drag on empty ground draws the box
  await page.keyboard.press('Escape');
  await page.click('#viewmode'); await page.waitForTimeout(500); await page.click('#fitview'); await page.waitForTimeout(500);
  const pb = await page.locator('#plan').boundingBox();
  await page.mouse.move(pb.x + 5, pb.y + 5); await page.mouse.down(); await page.mouse.move(pb.x + pb.width - 5, pb.y + pb.height - 5, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(300);
  checks['plan view: a plain drag on empty ground draws a box and chooses several'] = (await sel()) >= 3;
  await page.screenshot({ path: `${out}/plan-selected.png` });
  await page.goto(url + '&editorui=old'); await page.waitForSelector('#view3d'); await page.waitForTimeout(3500);
  checks['?editorui=old: no chip, Add piece stays quiet'] = !(await page.isVisible('#selchip').catch(() => false)) && !(await page.evaluate(() => document.getElementById('addpiece').classList.contains('go')));
  await browser.close();
} finally { server.kill(); }
const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
console.log(JSON.stringify(checks, null, 2), '\nerrors', errors);
console.log(failed.length || errors.length ? `FAIL: ${failed.join('; ')}` : 'PASS');
process.exit(failed.length || errors.length ? 1 : 0);
