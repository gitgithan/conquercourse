// The "Fastest runs" card sits at the top right of the Course: it must not overlap the top-right buttons (Edit this course, Whole course, Customize background, Rotate Camera, ?)
// nor the Looking-ahead picture, at 1280 x 800 and 1920 x 1020. Usage: PORT=5461 node scripts/board-corner-check.mjs  (a Vite dev server must run on PORT). Picture: docs/evidence/cc-133-board-corner-1280.png
import { chromium } from 'playwright';
const port = process.env.PORT ?? '5461';
const flags = ['--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'];
const browser = await chromium.launch({ args: flags });
let ok = true;
for (const [w, h] of [[1280, 800], [1920, 1020]]) {
  const page = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
  await page.addInitScript(() => { try { localStorage.setItem('cc.next.seen', '1'); } catch { /* ok */ } });
  await page.goto(`http://localhost:${port}/?course=/assets/demo/training.course.json&rookie=a&nosave=1&backend=webgl2&welcome=0&tour=0`, { timeout: 240000 });
  await page.waitForSelector('html[data-ready=true]', { timeout: 240000 });
  await page.waitForSelector('#board-corner', { timeout: 30000 });
  await page.waitForTimeout(3500); // the buttons settle, the card re-places itself
  const r = await page.evaluate(() => {
    const box = (e) => { const b = e?.getBoundingClientRect(); return b && b.width ? { l: b.left, t: b.top, r: b.right, b: b.bottom } : null; };
    const card = box(document.getElementById('board-corner'));
    const others = ['editcourse', 'wholeideal', 'custombg', 'cam', 'help', 'helpbtn', 'pip', 'frontview', 'toolbar'].map((id) => [id, box(document.getElementById(id))]).filter(([, b]) => b);
    const hit = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
    return { card, inside: card && card.l >= 0 && card.r <= innerWidth && card.t >= 0 && card.b <= innerHeight, overlaps: others.filter(([, b]) => hit(card, b)).map(([id]) => id), checked: others.map(([id]) => id) };
  });
  console.log(w, h, JSON.stringify(r));
  if (!r.card || !r.inside || r.overlaps.length) ok = false;
  if (w === 1280) await page.screenshot({ path: 'docs/evidence/cc-133-board-corner-1280.png', timeout: 600000 });
  await page.close();
}
await browser.close();
console.log(ok ? 'ok' : 'FAILED'); process.exit(ok ? 0 : 1);
