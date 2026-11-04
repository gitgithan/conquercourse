// CC-133: the end screen after a fall. Runs into the first gap, checks the eight actions are all there with one primary, and takes a 1280 px screenshot.
// Usage: PORT=5173 OUT=docs/evidence/cc-133-endscreen NAME=after node scripts/endscreen-check.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173', out = process.env.OUT ?? 'test-results/endscreen', name = process.env.NAME ?? 'fail';
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: flags });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
let bad = 0; const ok = (what, v) => { console.log(v ? 'ok  ' : 'FAIL', what); if (!v) bad++; };
await page.goto(`http://localhost:${port}/?backend=webgl2&welcome=0&tour=0&sunat=noon&course=/assets/demo/lache.course.json&startx=31`);
await page.waitForSelector('#keys', { state: 'attached', timeout: 120000 });
await page.waitForTimeout(2500);
const again = page.getByRole('button', { name: /^Try this .* again \(R\)$/ });
for (let k = 0; k < 3; k++) { // three falls, so the Train button is offered too
  await page.keyboard.down('ArrowRight');
  await again.waitFor({ state: 'visible', timeout: 120000 });
  await page.keyboard.up('ArrowRight');
  if (k < 2) { await again.click(); await page.waitForTimeout(1500); }
}
await page.waitForTimeout(800);
const labels = await page.locator('button').allInnerTexts();
const has = (re) => labels.some((l) => re.test(l));
ok('Try again (R)', has(/^Try this .* again \(R\)$/));
ok('Watch what happened', has(/^Watch what happened, with the numbers$/));
ok('Show me the ideal run (I)', has(/^Show me the ideal run \(I\)$/));
ok('Make it easier', await page.locator('#makeeasier').isVisible());
ok('Edit this course', await page.locator('#editfromfall').isVisible());
ok('Download a video', has(/^Download a video of this try$/));
ok('Copy link', has(/^Copy link to this try$/));
ok('Train the obstacle', has(/^Train the /));
ok('one primary button', (await page.locator('#fall-primary button').filter({ hasText: /again \(R\)/ }).count()) === 1);
await page.screenshot({ path: `${out}/${name}.png`, timeout: 150000 });
ok('no page errors', errors.length === 0);
await browser.close();
process.exit(bad ? 1 : 0);
