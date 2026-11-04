// Browser smoke for Generate and test at 1280 px. Usage: node scripts/lab-gentest-check.mjs [baseUrl]   Screenshots go to test-results/lab-gentest/.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://localhost:5173';
let bad = 0;
const check = (name, ok) => { console.log(ok ? 'ok  ' : 'FAIL', name); if (!ok) bad++; };
mkdirSync('test-results/lab-gentest', { recursive: true });
const browser = await chromium.launch();
try {
  const off = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await off.goto(`${base}/?mode=lab-gentest&labs=0`);
  await off.waitForSelector('#lab-gentest', { timeout: 60000 });
  check('off message', (await off.textContent('#lab-gentest')).includes('Labs are switched off'));
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}/?mode=lab-gentest&labs=1`);
  await page.waitForSelector('html[data-lab-ready=true]', { timeout: 60000 });
  await page.screenshot({ path: 'test-results/lab-gentest/start.png' });
  // recorded proposals, no repairs
  await page.click('#gt-run');
  await page.waitForSelector('html[data-lab-done="1"]', { timeout: 600000 });
  const facts1 = await page.textContent('#gt-facts');
  check('tested the default 25', facts1.includes('25'));
  check('some cleared and some thrown out', /Cleared as proposed\D*[1-9]/.test(facts1) && /Thrown out\D*[1-9]/.test(facts1));
  await page.screenshot({ path: 'test-results/lab-gentest/recorded.png', fullPage: true });
  // narrow rules + repairs
  const setRange = (sel, v) => page.$eval(sel, (el, val) => { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  await setRange('#gt-rep', '3');
  await setRange('#gt-lim', '10');
  await page.click('#gt-source button[data-source=both]');
  await page.click('#gt-run');
  await page.waitForSelector('html[data-lab-done="2"]', { timeout: 900000 });
  const facts2 = await page.textContent('#gt-facts');
  check('repairs reported', facts2.includes('more, so'));
  check('why table', (await page.textContent('#gt-why')).length > 5);
  check('compare shown last', (await page.textContent('#gt-ours-p')).includes('simulator decides'));
  await page.click('#gt-eq-btn');
  check('maths shown', (await page.textContent('#gt-eq-body')).includes('1 / p'));
  await page.screenshot({ path: 'test-results/lab-gentest/repairs.png', fullPage: true });
  check('no page errors', errors.length === 0);
  if (errors.length) console.log(errors);
} finally { await browser.close(); }
process.exit(bad ? 1 : 0);
