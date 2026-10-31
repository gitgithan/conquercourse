// Any page of the app for film A on the stepped clock: open a URL, wait, optionally click things (the pointer glides to each), keep N pictures.
// Usage: node scripts/film-a-page.mjs --name dojo --url "mode=dojo" --wait 1500 --frames 90 [--clicks "sel1;sel2"] [--hold 0.6] [--hide ".sel"] [--readySel css] [--fps 30] [--base URL]
import { Shot, arg } from './film-lib.mjs';
const fps = Number(arg('fps', 30)), base = arg('base', 'http://localhost:5173');
const shot = new Shot({ name: arg('name', 'page'), outDir: arg('out', 'films-a'), fps, width: Number(arg('width', 1280)), height: Number(arg('height', 720)) });
const sep = arg('url', '').includes('?') ? '&' : '?';
const page = await shot.open(`${base}/${sep === '?' ? '?' : ''}${arg('url', '')}${arg('url', '').includes('welcome') ? '' : '&welcome=0'}`.replace('/&', '/?'), { cursor: true, noTransitions: false, waitReady: arg('readySel') ? (p) => p.waitForSelector(arg('readySel'), { timeout: 180000 }) : null });
shot.sub = 2;
page.on('dialog', (d) => d.accept());
const ease = (u) => u * u * (3 - 2 * u);
await shot.advance(Number(arg('wait', 1500)));
await page.evaluate(() => document.querySelectorAll('body *').forEach((e) => { if (/^\s*Feedback\s*$/.test(e.textContent || '') && e.children.length === 0) e.style.display = 'none'; }));
const hold = Math.round(Number(arg('hold', 0.6)) * fps), clicks = (arg('clicks', '') || '').split(';').filter(Boolean);
const glide = async (x, y, n) => { const a = shot.pointer ?? [x, y]; await shot.frames(n, async (i) => { const u = ease((i + 1) / n); await page.mouse.move(a[0] + (x - a[0]) * u, a[1] + (y - a[1]) * u); }); shot.pointer = [x, y]; };
const total = Number(arg('frames', 60));
await shot.frames(Math.round(Number(arg('lead', 0.5)) * fps));
for (const sel of clicks) {
  const b = await page.locator(sel).first().boundingBox({ timeout: 3000 }).catch(() => null);
  if (b) await glide(b.x + b.width / 2, b.y + b.height / 2, Math.round(0.6 * fps));
  if (sel.startsWith('text=')) await page.locator(sel).first().click({ timeout: 8000 }).catch(() => {}); else await page.evaluate((s) => document.querySelector(s)?.click(), sel);
  await shot.frames(hold);
}
// --dragsel css --drag "x1,y1,x2,y2": a drag inside that element (fractions of its box), the pointer glides there first
if (arg('drag')) {
  const b = await page.locator(arg('dragsel')).first().boundingBox();
  const [x1, y1, x2, y2] = arg('drag').split(',').map(Number);
  await glide(b.x + b.width * x1, b.y + b.height * y1, Math.round(0.6 * fps));
  await page.mouse.down();
  await glide(b.x + b.width * x2, b.y + b.height * y2, Math.round(Number(arg('dragsec', 1.4)) * fps));
  await page.mouse.up();
  await shot.frames(hold);
}
await shot.frames(Math.max(0, total - shot.n));
await shot.close();
process.exit(0);
