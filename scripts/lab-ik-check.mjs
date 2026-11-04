// posing a character in the browser at 1280 px: off without the labs switch; with it the bar can be dragged, the elbow flips behind the back,
// the pose breaks past the reach, the maths box is closed until opened. Screenshots go to test-results/lab-ik/.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5183';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const result = {};
let failed = false;
const check = (name, ok, extra = '') => { result[name] = ok ? 'ok' : `FAILED ${extra}`; if (!ok) failed = true; };
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch();
  mkdirSync('test-results/lab-ik', { recursive: true });
  const base = `http://localhost:${port}`;
  const errors = [];

  const off = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  off.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await off.goto(`${base}/?mode=lab-ik&labs=0`);
  await off.waitForSelector('#lab-ik', { timeout: 60000 });
  check('off message', (await off.textContent('#lab-ik')).includes('Labs are switched off'));

  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await page.goto(`${base}/?mode=lab-ik&labs=1`);
  await page.waitForFunction(() => document.documentElement.dataset.labReady === 'true', null, { timeout: 90000 });
  const facts = () => page.textContent('#ik-facts');
  check('maths box closed at start', (await page.$eval('#ik-maths', (e) => !e.open)) === true);
  check('a reachable bar is hit', (await facts()).includes('Hand is on the bar'), await facts());
  await page.screenshot({ path: 'test-results/lab-ik/start.png', fullPage: true });

  // drag the bar with the mouse to the far side of the body: the elbow flips (the game's two-bone solver, no limits)
  const box = await page.$eval('#ik-pic', (c) => { const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const px = (mx, my) => [box.x + ((mx + 1.3) * 280 / 900) * box.w, box.y + ((560 - (my + 0.12) * 280) / 560) * box.h];
  const [ax, ay] = px(0.5, 1.2), [bx, by] = px(-0.2, 1.1);
  await page.mouse.move(ax, ay); await page.mouse.down();
  for (let i = 1; i <= 12; i++) { await page.mouse.move(ax + ((bx - ax) * i) / 12, ay + ((by - ay) * i) / 12); }
  await page.mouse.up();
  const behind = await facts();
  check('dragging behind the back flips the elbow', behind.includes('Flipped') && !/Elbow flips so far0/.test(behind), behind);
  await page.screenshot({ path: 'test-results/lab-ik/flip.png', fullPage: true });

  // limits on: the same bar is missed
  await page.click('#ik-limits button[data-v=on]');
  check('limits on: the behind-the-back bar is missed', (await facts()).includes('Pose breaks'), await facts());

  // out of reach, limits off: breaks past the full stretch; the slide button puts the bar on the breaking point
  await page.click('#ik-limits button[data-v=off]');
  await page.click('button[data-preset=far]');
  check('far bar breaks the pose', (await facts()).includes('Pose breaks'), await facts());
  await page.screenshot({ path: 'test-results/lab-ik/far.png', fullPage: true });
  await page.click('#ik-slide');
  check('sliding to the breaking point puts the hand on the bar', (await facts()).includes('Hand is on the bar'), await facts());

  // the neck rule: crouch fully, rule off shows the head past its limit, on keeps it within
  await page.fill('#ik-fold', '1');
  await page.dispatchEvent('#ik-fold', 'input');
  await page.click('#ik-neck button[data-v=off]');
  const neckOff = await page.$eval('#ik-facts', (e) => [...e.querySelectorAll('dt')].find((d) => d.textContent === 'Neck bend from the trunk').nextElementSibling.className);
  check('neck rule off: head flagged past its limit', neckOff === 'bad');
  await page.click('#ik-neck button[data-v=on]');
  const neckOn = await page.$eval('#ik-facts', (e) => [...e.querySelectorAll('dt')].find((d) => d.textContent === 'Neck bend from the trunk').nextElementSibling.className);
  check('neck rule on: head within its limit', neckOn === '');

  // the iterative solver arrives in several steps
  await page.click('#ik-solver button[data-v=dls]');
  await page.click('button[data-preset=ledge]');
  const dls = await facts();
  check('damped least squares uses steps', /Steps used\d+/.test(dls), dls);
  await page.click('#ik-maths summary');
  check('maths box opens with the equations', (await page.textContent('#ik-maths-body')).includes('Damped least squares'));
  check('the game is shown last', (await page.textContent('#ik-cmp-body')).includes('The game'));
  await page.screenshot({ path: 'test-results/lab-ik/dls.png', fullPage: true });

  check('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
} finally {
  server.kill();
}
console.log(JSON.stringify(result, null, 2));
process.exit(failed ? 1 : 0);
