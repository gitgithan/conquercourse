// CC-133: the Community README pictures, each its own 1920 x 1020 image in README_MEDIA/.
//   1: Explore, the default tab, with the pieces people made
//   2: Make your own, park03, "Mark it yourself" with a box dragged round the red platform (nothing is submitted)
//   3 and 4 (the 3D lift and the finished piece) sit behind Cloudflare Turnstile, so they are taken by hand and copied in unchanged
// It loads the PREVIEW site (the most complete set of pieces); nothing is deployed or submitted.
// Usage: node scripts/readme-shot-community.mjs [1|2|all] [outDir]
// To add a tile, add one entry to TILES (name, start URL, a ready selector, an act function that ends on the picture).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const which = process.argv[2] ?? 'all';
const out = process.argv[3] ?? 'README_MEDIA';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'https://preview.conquercourse.pages.dev/';
const q = 'mode=communities&welcome=0';

const TILES = {
  1: { name: 'community-1-explore', url: `?${q}`, ready: '#tab-explore',
    act: async (p) => {
      await p.waitForSelector('[id^=look-ex-]', { state: 'visible' });
      await p.waitForFunction(() => { const im = [...document.querySelectorAll('img')].filter((i) => i.offsetParent); return im.length >= 4 && im.every((i) => i.complete && i.naturalWidth > 0); }, null, { timeout: 60000 });
    } },
  2: { name: 'community-2-mark-yourself', url: `?${q}`, ready: '#make-own',
    act: async (p) => {
      await p.click('#make-own');
      await p.click('img[alt="sample place park03"]');
      await p.waitForSelector('#cmark', { state: 'visible' });
      await p.click('#cmark');
      await p.waitForTimeout(1500);
      const r = await p.locator('img[alt="your photo"]').boundingBox();
      // the red platform sits at about 6% to 66% across and 49% to 86% down the photo
      const x0 = r.x + r.width * 0.058, x1 = r.x + r.width * 0.662, y0 = r.y + r.height * 0.49, y1 = r.y + r.height * 0.865;
      await p.mouse.move(x0, y0); await p.mouse.down(); await p.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 8 });
      await p.mouse.move(x1, y1, { steps: 8 }); await p.mouse.up();
    } },
};

const b = await chromium.launch({ args: ['--no-sandbox'] });
for (const [k, t] of Object.entries(TILES)) {
  if (which !== 'all' && which !== k) continue;
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1020 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 160)));
  await page.goto(base + t.url, { timeout: 120000 });
  await page.waitForSelector(t.ready, { timeout: 120000 });
  await page.waitForTimeout(3000);
  await t.act(page);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/${t.name}.png` });
  console.log(k, t.name);
  await ctx.close();
}
await b.close();
