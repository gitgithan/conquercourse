// Promo storyboard scene 7 (CC-133): "Go for Mastery". No overlay (owner, 2026-11-05).
// Labs mind map -> hover every Pipelines tile 1 s (edges update) -> click Know the limits -> drag cards across bins (3 s) -> Page Down twice, 2 s after each.
// usage: node scene7.mjs <playwright> <outdir> [baseUrl]
import { openSession } from './lib.mjs';
const [pw, out, base = 'http://localhost:5173'] = process.argv.slice(2);
const S = await openSession({ url: null, out, pw }); const p = S.p;
await p.addInitScript(() => { try { localStorage.setItem('cc.next.seen', '1'); } catch { /* ok */ } });
await p.goto(base + '/?mode=lab-motion&hooks=1&backend=webgl2');
await p.waitForSelector('#labs-open', { timeout: 90000 }); await S.settle(4000); await S.hideChrome();
await p.click('#labs-open'); await p.waitForSelector('.lp-tile', { timeout: 60000 }); await S.settle(800);
await S.rec(0.4); S.mark('map');
// every tile in the Pipelines boxes, in page order, 1 s each
const tiles = await p.evaluate(() => [...document.querySelectorAll('.lp-box[data-tier=pipelines] a.lp-tile')].map((a) => { const r = a.getBoundingClientRect(); return { mode: a.dataset.lab, x: r.x + r.width / 2, y: r.y + r.height / 2 }; }));
console.log('pipeline tiles', JSON.stringify(tiles));
for (const t of tiles) { await S.glide(t.x, t.y, 0.3); await S.rec(0.7); S.mark('hover-' + t.mode); }
const lim = tiles.find((t) => t.mode === 'lab-limits'); if (!lim) throw new Error('no lab-limits tile');
if (tiles[tiles.length - 1].mode !== 'lab-limits') { await S.glide(lim.x, lim.y, 0.4); }
await p.mouse.down(); await S.rec(0.4); S.mark('click-limits');
await p.mouse.up(); await p.waitForURL(/lab-limits/, { timeout: 60000 }).catch(() => {}); await p.waitForLoadState('load').catch(() => {});
await p.waitForSelector('#lim-bins .fc, #lim-tray .fc', { timeout: 60000 }); await S.settle(2500); await S.hideChrome();
await S.rec(0.5); S.mark('lab');
// drag some cards across columns: 3 s in total
const cardsOf = () => p.evaluate(() => [...document.querySelectorAll('#lim-bins .cards .fc, #lim-tray .fc')].map((c) => ({ id: c.dataset.card, bin: c.closest('.bin')?.dataset.bin || 'tray' })));
const box = (sel) => p.evaluate((s) => { const e = document.querySelector(s); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
await p.evaluate(() => document.querySelector('#lim-bins').scrollIntoView({ block: 'start' })); await S.rec(0.3);
const bins = await p.evaluate(() => [...document.querySelectorAll('#lim-bins .bin')].map((b) => b.dataset.bin));
console.log('cards', JSON.stringify(await cardsOf()), 'bins', bins);
for (let i = 0; i < 3; i++) {
  const cs = await cardsOf(); const c = cs.find((x) => x.bin !== 'tray') || cs[0];
  const target = bins[(bins.indexOf(c.bin) + 1 + i) % bins.length];
  const a = await p.evaluate((id) => { const r = document.getElementById('lim-card-' + id).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + 20 }; }, c.id);
  const b = await p.evaluate((id) => { const r = document.querySelector('#lim-bin-' + id).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, target);
  await S.glide(a.x, a.y, 0.2); await p.mouse.down(); await S.rec(0.05);
  await S.glide(b.x, b.y, 0.55); await p.mouse.up(); await S.rec(0.2); S.mark('drag' + i);
}
// Page Down twice, 2 s after each
for (let i = 0; i < 2; i++) { await p.keyboard.press('PageDown'); await S.rec(2); S.mark('pagedown' + i); }
await S.finish({ overlay: 'none' });
