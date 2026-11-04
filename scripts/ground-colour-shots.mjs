// CC-133: the same camera on three places with the ground colour off and on, 1280 x 720. Needs `npm run dev` on :5173 (or pass BASE).
// Usage: node scripts/ground-colour-shots.mjs   (writes test-results/gc/<slug>-{off,on}-{wide,near}.png)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://localhost:5173', out = 'test-results/gc';
mkdirSync(out, { recursive: true });
const places = (process.env.PLACES ?? 'montmartre-paris,bellingham-parkour-wa,circular-quay-sydney,retiro-park-madrid,gerlev-parkour-park').split(',');
const views = { wide: 'az=35&el=38&dist=230', near: 'az=20&el=55&dist=120' };
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
for (const p of places) for (const gc of ['0', '1']) for (const [v, cam] of Object.entries(views)) {
  await page.goto(`${base}/place-skin.html?place=${p}&skin=tags&groundcolour=${gc}&hidenote=1&${cam}`);
  await page.waitForFunction(() => window.__skin?.ready, null, { timeout: 120000, polling: 500 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${p}-${gc === '1' ? 'on' : 'off'}-${v}.png` });
  console.log(p, gc, v, JSON.stringify(await page.evaluate(() => window.__skin)));
}
await browser.close();
