// CC-178: before/after screenshots of the place skins (none / tags / full) on 4 places. Needs `npm run dev` on :5173 (or pass BASE).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://localhost:5173', out = 'data/eval/cc-178-places/skin-shots';
mkdirSync(out, { recursive: true });
const places = ['montmartre-paris', 'retiro-park-madrid', 'circular-quay-sydney'];
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
for (const p of places) for (const skin of ['none', 'tags', 'full']) {
  await page.goto(`${base}/place-skin.html?place=${p}&skin=${skin}&az=35&el=38`);
  await page.waitForFunction(() => window.__skin?.ready, null, { timeout: 400000, polling: 500 });
  const s = await page.evaluate(() => window.__skin);
  await page.screenshot({ path: `${out}/${p}-${skin}.png` });
  console.log(p, skin, JSON.stringify(s));
}
await browser.close();
