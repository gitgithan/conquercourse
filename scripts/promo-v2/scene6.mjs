// Promo storyboard scene 6 (CC-133): Learn the Basics, the Dojo Gap jump lesson. No overlay.
// usage: node scene6.mjs <playwright> <outdir> [baseUrl]
// Beats: 2 s The real obstacle, click The idea (2 s), click The exact formula and drag sliders (2 s), click Rope swing (2 s), click Stored energy (2 s).
import { openSession } from './lib.mjs';
const [pw, out, base = 'http://localhost:5173'] = process.argv.slice(2);
const S = await openSession({ url: null, out, pw }); const p = S.p;
await p.addInitScript(() => { try { localStorage.setItem('cc.next.seen', '1'); } catch { /* ok */ } });
await p.goto(base + '/?mode=dojo&ex=gap&welcome=0&hooks=1&backend=webgl2');
await p.waitForSelector('.dojo', { timeout: 60000 });
await S.settle(2500); await S.hideChrome();
const click = async (sel, rest) => {
  await p.evaluate(() => document.querySelectorAll('*').forEach((e) => { if (e.scrollWidth > e.clientWidth) e.style.scrollBehavior = 'auto'; }));
  await p.locator(sel).first().scrollIntoViewIfNeeded();
  await S.rec(0.25);
  await S.clickSel(sel, { move: 0.4, hold: 0.2, after: 0 });
  await S.rec(rest);
};
S.mark = (k) => { S.marks[k] = +(S.n / S.fps).toFixed(2); };
// slow drift of the pointer so the screen is never still for a whole second
await S.glide(1300, 500, 0.5); await S.rec(1.5); S.mark('real');
await click('.tabs button:has-text("The idea")', 1.25); S.mark('idea');
await click('button[aria-label$="The exact formula"]', 0.05); S.mark('formulaClick');
await p.waitForSelector('input[type=range]');
const ids = await p.$$eval('input[type=range]', (a) => a.map((x) => x.id));
console.log('sliders', JSON.stringify(ids));
const i0 = '#' + ids[0], i1 = '#' + (ids[1] ?? ids[0]);
const val = (s) => p.evaluate((q) => Number(document.querySelector(q).value), s);
const rng = (s) => p.evaluate((q) => { const e = document.querySelector(q); return [+e.min, +e.max]; }, s);
await S.glideTo(i0, 0.25);
const [a0, a1] = await rng(i0), v0 = await val(i0);
await S.slide(i0, a0 + (a1 - a0) * 0.85, 0.5);
await S.glideTo(i1, 0.2);
const [b0, b1] = await rng(i1), w0 = await val(i1);
await S.slide(i1, b0 + (b1 - b0) * 0.8, 0.5); S.mark('sliders');
await click('.tabs button:has-text("Rope swing")', 1.15); S.mark('rope');
await click('.tabs button:has-text("Stored energy")', 1.15); S.mark('stored');
await S.rec(0.2);
await S.finish({ note: 'scene 6 learn the basics' });
