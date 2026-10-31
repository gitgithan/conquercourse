// Browser smoke for Lab 4 (computer vision): opens ?mode=lab-vision&labs=1 at 1280 px, moves the score cut, marks two settings, shows the game's setting and the maths, saves a screenshot.
// usage: node scripts/lab-vision-check.mjs [baseUrl] [out.png]
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://localhost:5173';
const out = process.argv[3] ?? 'test-results/lab-vision.png';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && console.log('console', m.text()));
await page.goto(`${base}/lab-vision-harness.html?labs=1`);
await page.waitForSelector('#lab-vision[data-ready="1"]', { timeout: 30000, state: 'attached' });
const facts = async () => (await page.locator('#lv-facts').innerText()).replace(/\s+/g, ' ');
const first = await facts();
await page.locator('#lv-mark').click();
await page.locator('#lv-score').fill('0.8');
const second = await facts();
await page.locator('#lv-mark').click();
await page.locator('#lv-ours-btn').click();
await page.locator('#lv-eq-btn').click();
const thumbs = await page.locator('#lv-thumbs .th').count();
const states = await page.locator('#lv-thumbs .th').evaluateAll((els) => els.map((e) => e.dataset.state));
console.log(JSON.stringify({ first, second, thumbs, kept: states.filter((s) => s !== 'dropped').length, rows: await page.locator('#lv-rows tr').count(), errors }, null, 1));
await page.evaluate(() => { document.querySelector('#lab-vision').scrollTop = 0; });
await page.screenshot({ path: out });
await browser.close();
if (errors.length || thumbs < 20 || first === second) process.exit(1);
