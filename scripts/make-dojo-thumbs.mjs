// Makes the picture of each Dojo card in the Courses gallery: public/assets/thumbs/dojo-<id>.webp (640x360).
// It is a screenshot of the first lesson picture ("The real obstacle") of our own Dojo page.
// Usage: node scripts/make-dojo-thumbs.mjs [baseUrl]
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5173';
const ids = ['gap', 'wall', 'rope', 'trampoline', 'landing', 'bars', 'coaster', 'lever', 'recoil', 'bridge', 'cannon', 'stored', 'drone'];
mkdirSync('public/assets/thumbs', { recursive: true });
const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
for (const id of ids) {
  await page.goto(`${base}/?mode=dojo&ex=${id}&welcome=0`);
  await page.waitForTimeout(4000);
  const pic = page.locator('svg:visible, canvas.stage:visible').first();
  const png = (await pic.screenshot({ type: 'png' })).toString('base64');
  const webp = await page.evaluate(async (data) => {
    const img = new Image(); img.src = `data:image/png;base64,${data}`; await img.decode();
    const c = document.createElement('canvas'); c.width = 640; c.height = 360;
    const g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, 640, 360);
    const k = Math.min(640 / img.width, 360 / img.height); const w = img.width * k, h = img.height * k;
    g.drawImage(img, (640 - w) / 2, (360 - h) / 2, w, h);
    return c.toDataURL('image/webp', 0.85).split(',')[1];
  }, png);
  writeFileSync(`public/assets/thumbs/dojo-${id}.webp`, Buffer.from(webp, 'base64'));
  console.log(id, Buffer.from(webp, 'base64').length);
}
await browser.close();
