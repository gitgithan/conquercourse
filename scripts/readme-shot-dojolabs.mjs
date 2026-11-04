// CC-133: the four README pictures for the Dojo and Labs screens, each its own 1920 x 1020 image in README_MEDIA/.
//   1: the Dojo lesson for the Gap jump, step 1 "Why it matters"
//   2: "Labs" on the top bar of a Lab, which slides the dependency map down
//   3: the Signal processing Lab, scrolled to the top (the Rookie and the graphs)
//   4: a click on the System design node of the map, which opens the System design Lab
// Usage: PORT=5173 node scripts/readme-shot-dojolabs.mjs [1|2|3|4|all] [outDir]
// To add a tile, add one entry to TILES (name, start URL, an act function that ends on the picture, a ready selector).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const port = process.env.PORT ?? '5173';
const which = process.argv[2] ?? 'all';
const out = process.argv[3] ?? 'README_MEDIA';
mkdirSync(out, { recursive: true });
const base = `http://localhost:${port}/`;
const flags = ['--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'];
const q = 'welcome=0&tour=0&backend=webgl2';
const settle = (p) => p.waitForTimeout(2500);

const TILES = {
  1: { name: 'dojo-labs-1-gap-jump-why', url: `?mode=dojo&ex=gap&${q}`,
    ready: '.dojo.v2 .path .node.on', act: async () => {} },
  2: { name: 'dojo-labs-2-labs-map', url: `?mode=lab-signal&labs=1&${q}`,
    ready: '#labs-open', act: async (p) => { await p.click('#labs-open'); await p.waitForSelector('#labs-panel a[href*=lab-systemdesign]', { state: 'visible' }); } },
  3: { name: 'dojo-labs-3-signal-processing-lab', url: `?mode=lab-signal&labs=1&${q}`,
    ready: '#labs-open', act: async (p) => { await p.evaluate(() => scrollTo(0, 0)); await p.waitForSelector('canvas, svg', { state: 'visible' }); await p.waitForTimeout(4000); } },
  4: { name: 'dojo-labs-4-system-design-lab', url: `?mode=lab-signal&labs=1&${q}`,
    ready: '#labs-open', act: async (p) => { await p.click('#labs-open'); await p.click('#labs-panel a[href*=lab-systemdesign]'); await p.waitForSelector('#lab-systemdesign', { timeout: 120000 }); await p.waitForTimeout(3000); } },
};

for (const [k, t] of Object.entries(TILES)) {
  if (which !== 'all' && which !== k) continue;
  const b = await chromium.launch({ args: flags });
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1020 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('cc.next.seen', '1'); } catch { /* ok */ } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 160)));
  await page.goto(base + t.url, { timeout: 240000 });
  await page.waitForSelector(t.ready, { timeout: 240000 });
  await settle(page);
  await t.act(page);
  await settle(page);
  await page.screenshot({ path: `${out}/${t.name}.png` });
  console.log(k, t.name);
  await b.close();
}
