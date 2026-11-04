// Lab 14 (cut-out, lift and bake) in the browser at 1280 px: off without the labs switch; with it, opens already run, the height slider changes the scale, each step toggle changes the facts.
// Screenshots go to test-results/lab-lift/.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5183';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const result = {};
let failed = false;
const check = (name, ok, extra = '') => { result[name] = ok ? 'ok' : `FAILED ${extra}`; if (!ok) failed = true; };
try {
  await new Promise((r) => setTimeout(r, 4000));
  const browser = await chromium.launch({ args: process.env.WEBGL ? ['--use-gl=swiftshader'] : [] });
  mkdirSync('test-results/lab-lift', { recursive: true });
  const base = `http://localhost:${port}`;
  const errors = [];
  const off = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  off.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await off.goto(`${base}/?mode=lab-lift&labs=0`);
  await off.waitForSelector('#lab-lift', { timeout: 60000 });
  check('off message', (await off.textContent('#lab-lift')).includes('Labs are switched off'));

  const page = await (await browser.newContext({ viewport: { width: 1280, height: 1500 } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await page.goto(`${base}/?mode=lab-lift&labs=1`);
  await page.waitForFunction(() => document.documentElement.dataset.labDone === '1', null, { timeout: 60000 });
  const facts = () => page.textContent('#ll-facts');
  check('opens already run', (await facts()).includes('0.80 m'), await facts());
  check('opens on a real raw lift', (await page.textContent('#ll-facts')).includes('the real raw lift') && (await page.textContent('#ll-obj')).includes('p1-bench-left'));
  await page.fill('#ll-yaw', '50'); await page.dispatchEvent('#ll-yaw', 'input');
  check('turn slider keeps the baked size (face step on)', (await facts()).includes('0.80 m') && (await facts()).includes('Turned by you50 degrees'), await facts());
  await page.screenshot({ path: 'test-results/lab-lift/real-raw-turned.png', fullPage: true });
  await page.fill('#ll-yaw', '0'); await page.dispatchEvent('#ll-yaw', 'input');
  await page.selectOption('#ll-obj', 'bench-concrete');
  await page.waitForFunction(() => document.querySelector('#ll-cut img') !== null, null, { timeout: 30000 });
  check('says all steps on', (await page.textContent('#ll-break')).includes('All seven steps are on'));
  check('cut-out picture', (await page.$('#ll-cut img')) !== null);
  check('maths hidden', await page.$eval('#ll-eq-body', (e) => e.hidden));
  const px = await page.$eval('#ll-side', (c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] !== d[i + 1] || d[i + 1] !== d[i + 2]) n++; return n; });
  check('side view has colour from the texture', px > 500, String(px));
  await page.screenshot({ path: 'test-results/lab-lift/start.png', fullPage: true });
  await page.fill('#ll-h', '1.6');
  await page.dispatchEvent('#ll-h', 'input');
  check('slider changes the height', (await facts()).includes('1.60 m'), await facts());
  await page.click('input[data-step=scale]');
  check('no scale step: tiny and says so', (await page.textContent('#ll-break')).includes('own size'));
  await page.click('input[data-step=scale]');
  await page.click('input[data-step=reduce]');
  check('no reduce shows raw faces', (await facts()).includes('387,796'));
  await page.click('input[data-step=reduce]');
  await page.click('input[data-step=ground]');
  check('no ground: off the ground', !(await facts()).includes('Lowest point0.00 m'), await facts());
  await page.click('input[data-step=ground]');
  await page.fill('#ll-mh', '2.4'); await page.dispatchEvent('#ll-mh', 'input');
  check('thin bar 52 m', (await page.textContent('#ll-mlen')).includes('52'), await page.textContent('#ll-mlen'));
  await page.selectOption('#ll-obj', 'railing-iron');
  await page.waitForFunction(() => document.querySelector('#ll-cut img')?.getAttribute('src')?.includes('rail01'));
  check('railing opens its cut-out', true);
  await page.click('#ll-eq-btn');
  check('maths shown', (await page.textContent('#ll-eq-body')).includes('bar length'));
  await page.screenshot({ path: 'test-results/lab-lift/after.png', fullPage: true });
  check('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
} catch (e) { check('script', false, String(e).slice(0, 300)); }
finally { server.kill(); }
console.log(JSON.stringify(result, null, 2));
process.exit(failed ? 1 : 0);
