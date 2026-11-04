// Lab 19 (same run, any machine) in the browser at 1280 px: off without the labs switch; with it every output is filled on open, the stored traces match this browser,
// and the three challenge levels are solved with the fewest pins. Screenshots go to test-results/lab-determinism/.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5185';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const result = {};
let failed = false;
const check = (name, ok, extra = '') => { result[name] = ok ? 'ok' : `FAILED ${extra}`; if (!ok) failed = true; };
try {
  await new Promise((r) => setTimeout(r, 4000));
  const browser = await chromium.launch({ args: process.env.WEBGL2 ? ['--use-gl=angle', '--use-angle=swiftshader'] : [] });
  mkdirSync('test-results/lab-determinism', { recursive: true });
  const base = `http://localhost:${port}`;
  const errors = [];
  const off = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  off.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await off.goto(`${base}/?mode=lab-determinism&labs=0&backend=webgl2`);
  await off.waitForSelector('#lab-determinism', { timeout: 60000 });
  check('off message', (await off.textContent('#lab-determinism')).includes('Labs are switched off'));
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await page.goto(`${base}/?mode=lab-determinism&labs=1&backend=webgl2&sunat=noon`);
  await page.waitForFunction(() => document.documentElement.dataset.labPopulated === 'lab-determinism', null, { timeout: 120000 });
  const txt = await page.textContent('#lab-determinism');
  check('no NaN or undefined', !/undefined|NaN/.test(txt), txt.slice(0, 300));
  check('nav bar names the Lab', (await page.textContent('#labs-nav')).includes('Same run, any machine'));
  const rows = await page.$$eval('#ld-trace tr', (r) => r.map((x) => x.textContent));
  // the swing course uses sin and cos, which another browser engine may round differently: that is allowed and must then be shown in words
  const note = (await page.textContent('#ld-trace-note')).trim();
  check('four stored traces; the plank and drop ones are the same, any different one is explained', rows.length === 4 && rows.slice(0, 3).every((t) => t.endsWith('same')) && (rows.every((t) => t.endsWith('same')) ? note === '' : note.includes('Different here')), rows.join(' | ') + ' // ' + note);
  check('opens green with every pin on', (await page.textContent('#ld-b-first')).includes('agree'), await page.textContent('#ld-b-first'));
  check('opens on level 2, red', (await page.getAttribute('#ld-c-verdict', 'data-agree')) === 'false');
  await page.screenshot({ path: 'test-results/lab-determinism/open.png', fullPage: true });
  // turn the ordered walk off for machine B: the first mismatch is frame 1
  await page.uncheck('#ld-b-pin-ordered');
  check('unpinned order: first mismatch', (await page.textContent('#ld-b-first')).includes('First mismatch'), await page.textContent('#ld-b-first'));
  await page.check('#ld-b-pin-ordered');
  const solve = async (level, fixed, ordered, grid) => {
    await page.click(`#ld-lv button[data-level="${level}"]`);
    for (const [id, on] of [['ld-c-pin-fixed', fixed], ['ld-c-pin-ordered', ordered]]) await (on ? page.check(`#${id}`) : page.uncheck(`#${id}`));
    await page.selectOption('#ld-c-pin-grid', grid);
    const d = await page.getAttribute('#ld-c-verdict', 'data-agree'), pins = await page.getAttribute('#ld-c-verdict', 'data-pins'), best = await page.getAttribute('#ld-c-verdict', 'data-fewest');
    check(`level ${level} solved with the fewest pins`, d === 'true' && pins === best, `${d} ${pins} ${best}`);
  };
  await solve(1, false, true, '');
  await solve(2, false, true, '0.01');
  await page.screenshot({ path: 'test-results/lab-determinism/level2.png', fullPage: true });
  await solve(3, true, true, '0.01');
  await page.click('#ld-lv button[data-level="3"]'); await page.uncheck('#ld-c-pin-fixed');
  check('level 3 without the fixed step is red', (await page.getAttribute('#ld-c-verdict', 'data-agree')) === 'false');
  // every level has an answer on the course the challenge opens with, whatever the picker says
  await page.selectOption('#ld-course', 'lache'); await page.waitForTimeout(1500);
  await page.click('#ld-lv button[data-level="2"]');
  check('challenge still has an answer after picking the swing course', /^\d+$/.test(await page.getAttribute('#ld-c-verdict', 'data-fewest')));
  // the real machines table and the real-difference card are filled from the recorded file
  const realRows = await page.$$eval('#ld-real-t tr', (r) => r.map((x) => x.textContent));
  check('real machines table has Node, Chromium, Firefox and WebKit', ['node', 'chromium', 'firefox', 'webkit'].every((w) => realRows.some((t) => t.toLowerCase().includes(w))), realRows.join(' | '));
  check('real table says it is recorded, not run here', (await page.textContent('#ld-real-note')).includes('not run in your browser'));
  check('real-difference card is filled', (await page.textContent('#ld-found-says')).length > 80);
  check('widget links to the real machines', (await page.textContent('#ld-b-real')).includes('Real machines'));
  await page.screenshot({ path: 'test-results/lab-determinism/real.png', fullPage: true });
  check('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
} catch (e) { check('run', false, String(e)); } finally { server.kill(); }
console.log(JSON.stringify(result, null, 2));
process.exit(failed ? 1 : 0);
