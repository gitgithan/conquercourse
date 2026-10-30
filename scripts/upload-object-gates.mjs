// Browser check for the refusals on the photo -> 3D object path (CC-221): each gate's plain message on screen, no object added, retry only when it can help.
// Server answers are stubbed (the gate logic itself is tested in tests/object-lift.test.ts). Run: PORT=5199 node scripts/upload-object-gates.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const submit = (status, body) => ({ submit: { status, body } });
const SCENARIOS = [
  ['blocked at triage', submit(403, { error: 'moderation', message: 'This photo cannot be used here.' }), /cannot be used here/, false],
  ['needs a person to look', submit(403, { error: 'moderation', message: 'This photo needs a person to look at it first, so it cannot be turned into an object now.' }), /needs a person/, false],
  ['safety check down', submit(403, { error: 'moderation', message: 'The safety check could not run just now, so nothing was made. Try again in a few minutes.' }), /safety check could not run/, false],
  ['player used todays slots', submit(429, { error: 'daily', message: "You have used today's objects. Try again tomorrow, or pick one from the library." }), /Try again tomorrow/, false],
  ['game budget used up', submit(429, { error: 'budget', message: "Today's makers are used up. Try again tomorrow, or pick one from the library." }), /makers are used up/, false],
  ['burst limit', submit(429, { error: 'busy', message: 'You made a lot of objects just now. Wait a few minutes.' }), /Wait a few minutes/, true],
  ['service off', submit(503, { error: 'not allowed' }), /not switched on/, true],
  ['service down', submit(502, { error: 'down' }), /not answering/, true],
  ['no object in the box', { submit: { status: 200, body: { id: 'fc-ABCDEFGHIJKL' } }, poll: { state: 'failed', reason: 'empty' } }, /Draw the box tighter/, true],
  ['job failed, no reason', { submit: { status: 200, body: { id: 'fc-ABCDEFGHIJKL' } }, poll: { state: 'failed', reason: 'weird' } }, /Something went wrong/, true],
];
const checks = {};
mkdirSync('test-results/upload-gates', { recursive: true });
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 200)));
  let plan = SCENARIOS[0][1];
  await page.route('**/api/object-lift', async (route) => {
    const b = JSON.parse(route.request().postData());
    const r = b.action === 'submit' ? plan.submit : { status: 200, body: plan.poll };
    return route.fulfill({ status: r.status, contentType: 'application/json', body: JSON.stringify(r.body) });
  });
  await page.goto(`http://localhost:${port}/?mode=editor&uploadobj=1`);
  await page.waitForSelector('#makeobj', { state: 'attached', timeout: 90000 });
  let n = 0;
  for (const [name, stub, words, canRetry] of SCENARIOS) {
    plan = stub; n++;
    await page.$eval('#makeobj', (e) => e.click());
    await page.setInputFiles('#pofile', 'public/assets/park/park01.jpg');
    const img = page.locator('#photoobj img');
    await img.waitFor({ timeout: 40000 });
    const r = await img.boundingBox();
    await page.mouse.move(r.x + r.width * 0.3, r.y + r.height * 0.25); await page.mouse.down();
    await page.mouse.move(r.x + r.width * 0.65, r.y + r.height * 0.6, { steps: 6 }); await page.mouse.up();
    await page.fill('#polabel', 'bench');
    await page.click('#pogo');
    await page.waitForFunction((src) => new RegExp(src).test(document.querySelector('#pomsg')?.textContent ?? ''), words.source, { timeout: 60000 });
    const retryShown = await page.locator('#poretry').isVisible();
    const noObject = !/Mine/.test((await page.textContent('#panel')) ?? '');
    checks[name] = retryShown === canRetry && noObject;
    if (!checks[name]) console.log('FAIL', name, { retryShown, canRetry, noObject });
    await page.screenshot({ path: `test-results/upload-gates/${n}-${name.replace(/\W+/g, '-')}.png` });
    await page.click('#poclose');
  }
  await browser.close();
} finally { server.kill(); }
console.log(JSON.stringify(checks, null, 1));
process.exit(Object.values(checks).length === SCENARIOS.length && Object.values(checks).every(Boolean) ? 0 : 1);
