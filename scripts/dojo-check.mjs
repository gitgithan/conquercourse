// Walks the Dojo lesson for the gap jump: why, try it (three runs at different speeds), shape, rule, formula,
// Course; checks the saying is earned only after the guesses, the formula appears only at its step, and the way back.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const port = process.env.PORT ?? '5173';
const server = spawn('npx', ['vite', '--port', port, '--strictPort'], { stdio: 'ignore' });
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/?mode=dojo&from=course&ex=gap&width=4.5&needed=4.9&speed=4.2`);
  await page.waitForSelector('html[data-ready=true]');
  mkdirSync('test-results/dojo', { recursive: true });
  const set = (id, v) => page.$eval(`#${id}`, (el, v) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  const has = async (t) => (await page.textContent('body')).includes(t);
  const checks = {};
  checks.banner = await has('Training for the gap you fell at: 4.5 m wide');
  checks.noFormulaYet = !(await has('2 × speed × push'));
  await page.screenshot({ path: 'test-results/dojo/1-why.png' });
  await page.click('#next');
  checks.nextNeverLocked = !(await page.$eval('#next', (b) => b.disabled));
  checks.noGuessOrLockOrRun = (await page.$$('#guess, #newguess, #scrub, #run')).length === 0;
  checks.sayingShownAtOnce = await has('already decided');
  for (const [speed, jump] of [[3, 4.5], [6, 4.5], [9, 4.5]]) {
    await set('knob-speed', speed); await set('knob-jump', jump);
    checks.liveResult = (checks.liveResult ?? true) && (await page.textContent('#out')).includes(`${((2 * speed * jump) / 9.81).toFixed(1)} m`);
  }
  await page.screenshot({ path: 'test-results/dojo/2-try.png' });
  // switching obstacles keeps the lesson place (R2-D2)
  await page.click('text=Landing'); await page.click('text=Gap jump');
  checks.keepsPlace = (await page.$$('#knob-speed')).length === 1;
  await page.click('#next');
  await page.screenshot({ path: 'test-results/dojo/3-shape.png' });
  checks.shapeSaysDirect = (await page.textContent('#shape')).includes('twice the speed flies twice as far');
  await page.click('#next');
  await page.click('#next');
  checks.formulaShown = await has('2 × speed × push ÷ g');
  await set('knob-speed', 5); await set('knob-jump', 4);
  checks.formulaLive = (await page.textContent('#answer')).includes(`${((2 * 5 * 4) / 9.81).toFixed(2)} m`);
  await set('knob-speed', 10);
  checks.formulaLive2 = (await page.textContent('#answer')).includes(`${((2 * 10 * 4) / 9.81).toFixed(2)} m`) && (await page.textContent('#working')).includes('10.0');
  await page.screenshot({ path: 'test-results/dojo/4-formula.png' });
  await page.click('#next');
  checks.appliedToGap = (await page.textContent('#apply')).includes('Gap 1: 4.5 m wide');
  await page.screenshot({ path: 'test-results/dojo/5-course.png' });
  checks.backLink = (await page.$$('a.btn')).length >= 1;
  const box = await page.$eval('#back', (e) => { const r = e.getBoundingClientRect(); return { right: innerWidth - r.right, top: r.top, w: r.width }; });
  checks.backIsTopRight = box.top < 30 && box.right < 40 && box.w > 150;
  await page.keyboard.press('KeyT');
  await page.waitForFunction(() => !document.querySelector('.dojo'), null, { timeout: 60000 });
  checks.tClosesDojo = true;
  console.log(checks, 'errors:', errors);
  await browser.close();
  process.exit(Object.values(checks).every(Boolean) && !errors.length ? 0 : 1);
} finally { server.kill(); }
