// World Editor beats for film A on the stepped clock: the hand-off (the camera turns from far to fit), adding pieces, moving one, the Design partner's Fix it.
// Usage: node scripts/film-a-editor.mjs [--name editor] [--out films-a] [--fps 30] [--base URL] [--width 1280 --height 720]
import { Shot, arg } from './film-lib.mjs';
const fps = Number(arg('fps', 30)), base = arg('base', 'http://localhost:5173');
const shot = new Shot({ name: arg('name', 'editor'), outDir: arg('out', 'films-a'), fps, width: Number(arg('width', 1280)), height: Number(arg('height', 720)) });
const page = await shot.open(`${base}/?mode=editor&welcome=0`, { cursor: true, noTransitions: false, waitReady: (p) => p.waitForSelector('#view3d', { timeout: 180000 }) });
shot.sub = 2;
page.on('dialog', (d) => d.accept());
const secs = (s) => Math.round(s * fps), ease = (u) => u * u * (3 - 2 * u);
async function until(fn, a, maxS = 120) { const t0 = Date.now(); while (Date.now() - t0 < maxS * 1000) { let ok = false; try { ok = await page.evaluate(fn, a); } catch { /* the page is reloading */ } if (ok) return true; try { await shot.step(100); await shot.twoFrames(); } catch { /* reloading */ } await page.waitForTimeout(80); } return false; }
const glide = async (x, y, n) => { const a = shot.pointer ?? [x, y]; await shot.frames(n, async (i) => { const u = ease((i + 1) / n); await page.mouse.move(a[0] + (x - a[0]) * u, a[1] + (y - a[1]) * u); }); shot.pointer = [x, y]; };
const hideOverlays = async () => {
  for (let k = 0; k < 3; k++) {
    const hides = await page.getByRole('button', { name: 'Hide', exact: true }).all();
    for (const h of hides) await h.click({ timeout: 3000 }).catch(() => {});
    await shot.advance(300);
  }
  await page.evaluate(() => document.querySelectorAll('body *').forEach((e) => { if (/^\s*Feedback\s*$/.test(e.textContent || '') && e.children.length === 0) e.style.display = 'none'; }));
};
await shot.advance(1500);
await hideOverlays();
await page.selectOption('#presetpick', 'failing');
await page.waitForTimeout(2500);
await page.waitForSelector('#view3d', { timeout: 120000 });
await until(() => Number(document.documentElement.dataset.pieces ?? 0) >= 4, null, 60);
await shot.advance(1500);
await hideOverlays();
// far: the wheel takes the camera out, then Fit brings it round to the course (this is the picture the film cuts to from the slicer)
const view = await page.locator('#view3d').boundingBox();
await page.mouse.move(view.x + view.width / 2, view.y + view.height / 2);
for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, 400); await shot.advance(120); }
await shot.advance(800);
shot.mark('far');
await shot.frames(secs(0.5));
const fit = await page.locator('#fitview').boundingBox();
await glide(fit.x + fit.width / 2, fit.y + fit.height / 2, secs(0.7));
await page.click('#fitview');
await shot.frames(secs(1.8));
shot.mark('fit');
// add a bar and a block from the one Add pieces menu
const add = async (id, label) => {
  const b = await page.getByRole('button', { name: '+ Add pieces' }).boundingBox();
  await glide(b.x + b.width / 2, b.y + b.height / 2, secs(0.6));
  await page.getByRole('button', { name: '+ Add pieces' }).click();
  await shot.frames(secs(0.5));
  const item = await page.locator(id).boundingBox().catch(() => null);
  if (item) await glide(item.x + item.width / 2, item.y + item.height / 2, secs(0.4));
  await page.evaluate((sel) => document.querySelector(sel)?.click(), id);
  await shot.frames(secs(0.9));
  shot.mark('added ' + label);
};
await add('#addbar', 'bar');
await add('#add-block', 'block');
// pieces move in the Top plan: switch, fit, drag the newest piece, switch back
await page.click('#viewmode'); await shot.frames(secs(0.6));
await page.click('#fitview'); await shot.frames(secs(0.8));
const spots = await page.evaluate(() => window.ccPieceScreen());
const target = spots[spots.length - 1];
if (target) { await glide(target.x, target.y, secs(0.6)); await page.mouse.down(); await glide(target.x + 60, target.y + 20, secs(1.0)); await page.mouse.up(); await shot.frames(secs(0.5)); shot.mark('moved'); }
await page.click('#viewmode'); await shot.frames(secs(0.8));
await page.click('#fitview'); await shot.frames(secs(1.5));
// the Design partner: Fix it (the search runs in real time; the clock waits), then the proposal
await page.evaluate(() => document.querySelector('#helper')?.scrollIntoView({ block: 'center' }));
await shot.frames(secs(0.6));
await page.evaluate(() => { delete document.documentElement.dataset.fixed; document.querySelector('#fixit')?.click(); });
shot.mark('fix it clicked');
const t0 = shot.n;
for (let i = 0; i < secs(2.0); i++) await shot.frames(1);
await until(() => document.documentElement.dataset.fixed !== undefined, null, 240);
await shot.frames(secs(1.5));
shot.mark('fix answered');
if (await page.locator('#applypreview').count()) { await page.evaluate(() => document.querySelector('#applypreview')?.click()); await shot.frames(secs(2.0)); shot.mark('applied'); }
await shot.close();
process.exit(0);
