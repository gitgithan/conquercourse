// Browser smoke for the Parts gallery (docs/parts-gallery.md): opens ?mode=parts at 1280 px, plays a few cards in the real Course, opens
// "How a course is made", checks there are no page errors, and saves screenshots.
// Usage: node scripts/parts-gallery-smoke.mjs [baseUrl] [outDir] [--thumbs]
//   --thumbs  also saves one small picture per card to public/assets/parts-thumbs/<id>.webp (a frame from the real run)
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const base = args[0] ?? 'http://localhost:5173';
const out = args[1] ?? 'docs/evidence/parts-gallery';
const thumbs = process.argv.includes('--thumbs');
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: flags });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const report = { cards: 0, played: {}, strip: 0, errors };

const tickOf = (id) => page.evaluate((pid) => {
  const f = document.querySelector(`iframe[data-part="${pid}"]`);
  const d = f?.contentDocument?.documentElement;
  return d?.dataset.tick === undefined ? -1 : Number(d.dataset.tick);
}, id);
async function playCard(id, wantTick, shot) {
  const card = page.locator(`article[data-part="${id}"]:visible`).first();
  await card.scrollIntoViewIfNeeded();
  await card.locator('.pg-view').click();
  await page.waitForSelector(`iframe[data-part="${id}"]`);
  const start = Date.now();
  let t = -1;
  while (Date.now() - start < 90000) { t = await tickOf(id); if (t >= wantTick) break; await page.waitForTimeout(400); }
  report.played[id] = t;
  if (shot) await card.screenshot({ path: `${out}/${shot}` });
  return card;
}

await page.goto(`${base}/?mode=parts&welcome=0`);
await page.waitForSelector('article[data-part]');
report.cards = await page.locator('article[data-part]').count();
report.groups = await page.locator('.pg-grid').evaluateAll((g) => g.map((x) => `${x.dataset.group}:${x.children.length}`));
await page.screenshot({ path: `${out}/parts-top-1280.png` });

if (thumbs) {
  mkdirSync('public/assets/parts-thumbs', { recursive: true });
  const ids = await page.locator('article[data-part]').evaluateAll((a) => a.map((x) => x.dataset.part));
  for (const id of ids) {
    const card = page.locator(`article[data-part="${id}"]`).first();
    const live = await card.locator('.pg-play').textContent();
    if (live === 'No live scene') continue;
    await card.scrollIntoViewIfNeeded();
    await card.locator('.pg-view').click();
    await page.waitForSelector(`iframe[data-part="${id}"]`);
    const bot = live === 'Play';
    const start = Date.now();
    while (Date.now() - start < 90000) { const t = await tickOf(id); if (bot ? t >= 220 : t >= 0) break; await page.waitForTimeout(400); }
    if (!bot) await page.waitForTimeout(2500);
    const png = (await card.locator('.pg-view').screenshot({ type: 'png' })).toString('base64');
    const webp = await page.evaluate(async (data) => {
      const img = new Image(); img.src = `data:image/png;base64,${data}`; await img.decode();
      const c = document.createElement('canvas'); c.width = 480; c.height = 270;
      c.getContext('2d').drawImage(img, 0, 0, 480, 270);
      return c.toDataURL('image/webp', 0.72).split(',')[1];
    }, png);
    writeFileSync(`public/assets/parts-thumbs/${id}.webp`, Buffer.from(webp, 'base64'));
    await card.locator('.pg-view').click(); // stop it
    console.log('thumb', id);
  }
}

const first = ['gap', 'vault', 'trebuchet', 'cannon', 'lache', 'slide'];
for (const id of first) await playCard(id, id === 'slide' ? 0 : 150, `card-${id}-1280.png`);
await page.locator('article[data-part="trebuchet"]').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${out}/parts-special-playing-1280.png` });
await page.evaluate(() => scrollTo(0, 0));
await page.screenshot({ path: `${out}/parts-page-1280.png`, fullPage: true });

await page.click('#pg-tab-course');
await page.waitForSelector('#pg-strip .pg-card');
report.strip = await page.locator('#pg-strip .pg-card').count();
await page.locator('#pg-strip .pg-card').nth(1).click();
await page.waitForTimeout(1000);
let t = -1;
for (let i = 0; i < 150 && t < 150; i++) { t = await page.evaluate(() => { const d = document.querySelector('#pg-stage iframe')?.contentDocument?.documentElement; return d?.dataset.tick === undefined ? -1 : Number(d.dataset.tick); }); await page.waitForTimeout(400); }
report.stripTick = t;
await page.screenshot({ path: `${out}/parts-how-a-course-is-made-1280.png`, fullPage: true });

console.log(JSON.stringify(report));
await browser.close();
const bad = errors.length || report.cards < 30 || report.strip < 5 || Object.entries(report.played).some(([id, v]) => id !== 'slide' && v < 0);
process.exit(bad ? 1 : 0);
