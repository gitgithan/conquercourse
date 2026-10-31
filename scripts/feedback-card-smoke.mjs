// Feedback card smoke at 1280 x 720: opens from several screens, checks the filled-in fields, closes by Esc and by the backdrop,
// sends once (the request is caught in the browser, nothing reaches a server) and saves screenshots.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const out = process.env.OUT ?? 'test-results/cc-feedback-form';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const fail = [];
const check = (ok, what) => { if (!ok) fail.push(what); };
try {
  await new Promise((r) => setTimeout(r, 4000));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultTimeout(120000); // software rendering on the VM is slow
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  mkdirSync(out, { recursive: true });
  let sent = null;
  await page.route('**/api/submit', async (route) => { sent = JSON.parse(route.request().postData()); await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); });
  const screens = [['course', '/?welcome=0&nav=0'], ['dojo', '/?mode=dojo&welcome=0'], ['editor', '/?mode=editor&welcome=0'], ['map', '/?mode=map&welcome=0'], ['lab-search', '/?mode=lab-search&labs=1&welcome=0']];
  for (const [name, url] of screens) {
    await page.goto(`http://localhost:${port}${url}`);
    await page.waitForSelector('#cc-feedback-btn', { timeout: 90000 });
    await page.click('#cc-feedback-btn');
    await page.waitForSelector('#cc-feedback .fb');
    const where = await page.inputValue('#cc-feedback input[type=text]');
    const pre = await page.textContent('#cc-feedback pre');
    check(where.length > 3, `${name}: where is empty`);
    check(/screen: /.test(pre) && /window: 1280 x 720/.test(pre) && /build: /.test(pre), `${name}: what gets sent lacks screen, window or build`);
    check(!/@|Mozilla/.test(pre), `${name}: what gets sent holds an address or raw agent`);
    check(await page.evaluate(() => document.activeElement?.className.includes('fb-kind')), `${name}: focus is not on the first choice`);
    if (name === 'course') {
      check(await page.locator('#cc-feedback .fb-go').isDisabled(), 'send is on before anything is chosen');
      await page.click('.fb-kind >> nth=0');
      check(/press/i.test(await page.evaluate(() => document.querySelector('#cc-feedback .fb-prompt')?.textContent ?? '')), 'broke prompt missing');
      await page.fill('#cc-feedback textarea', 'I pressed jump and nothing happened');
      await page.click('.fb-chip:has-text("Not really")');
      await page.click('.fb-chip:has-text("Too fast")');
      await page.click('#cc-feedback summary');
      await page.screenshot({ path: `${out}/card-course-open-1280.png` });
    } else {
      await page.screenshot({ path: `${out}/card-${name}-1280.png` });
    }
    await page.keyboard.press('Escape');
    check((await page.locator('#cc-feedback').count()) === 0, `${name}: Esc did not close`);
    if (name === 'dojo') {
      await page.click('#cc-feedback-btn'); await page.waitForSelector('#cc-feedback');
      await page.mouse.click(8, 8);
      check((await page.locator('#cc-feedback').count()) === 0, 'backdrop click did not close');
    }
  }
  // send from the Course
  await page.goto(`http://localhost:${port}/?welcome=0&nav=0`);
  await page.waitForSelector('#cc-feedback-btn', { timeout: 90000 });
  await page.click('#cc-feedback-btn');
  await page.click('.fb-kind >> nth=1');
  await page.fill('#cc-feedback textarea', 'I could not tell what the wall does');
  await page.click('#cc-feedback summary');
  await page.uncheck('#cc-feedback .fb-ctx label:has-text("Browser") input');
  await page.click('#cc-feedback .fb-go');
  await page.waitForSelector('#cc-feedback[data-sent="1"]');
  await page.screenshot({ path: `${out}/card-thanks-1280.png` });
  check(sent && sent.v === 2 && sent.answers.kind === 'confusing', 'payload kind');
  check(sent && sent.context.browser === undefined && sent.context.screen === 'Course', 'unticked line still sent, or screen missing');
  check(sent && !JSON.stringify(sent).match(/@|Mozilla/), 'payload holds an address or raw agent');
  // old form switch
  await page.goto(`http://localhost:${port}/?welcome=0&nav=0&feedback=old`);
  await page.waitForSelector('#cc-feedback-btn', { timeout: 90000 });
  check((await page.textContent('#cc-feedback-btn')) === 'Feedback', 'old button');
  await page.click('#cc-feedback-btn');
  await page.waitForSelector('#cc-feedback h2');
  check(/Help shape/.test(await page.textContent('#cc-feedback h2')), 'old form did not open with ?feedback=old');
  // the button hides while a run is going
  await page.goto(`http://localhost:${port}/?welcome=0&nav=0`);
  await page.waitForSelector('#cc-feedback-btn', { timeout: 90000 });
  await page.waitForTimeout(1500);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(1500);
  const hidden = await page.locator('#cc-feedback-btn').isHidden();
  await page.keyboard.up('ArrowRight');
  check(hidden, 'button still shown during a run');
  console.log('errors:', errors, 'fail:', fail);
  await browser.close();
  process.exit(errors.length || fail.length ? 1 : 0);
} finally { server.kill(); }
