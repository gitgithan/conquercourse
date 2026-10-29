// CC-198/CC-199: the Design partner card in the World editor at 1280x720: where it sits, whether anything covers it, whether text overlaps, and that the wheel still zooms over the picture.
// TAG=before|after names the stills (data/eval/cc-198-partner/<tag>-*.png); EXTRA is a query string added to the URL (for example editorui=old).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? String(5300 + Math.floor(Math.random() * 600)), out = process.env.OUT ?? 'data/eval/cc-198-partner', tag = process.env.TAG ?? 'after';
mkdirSync(out, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const results = []; const check = (name, ok, extra = '') => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, extra); };
const LONG = 'Rathausplatz am Schloss Charlottenburg in Berlin-Mitte, Deutschland (the long place name test)';
const probe = (page) => page.evaluate(() => {
  const vis = (e) => { if (!e) return false; const cs = getComputedStyle(e), r = e.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
  const R = (e) => { const r = e.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) }; };
  const h = document.getElementById('helper');
  const hr = h && vis(h) ? R(h) : null;
  const hit = (a, b) => a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1;
  const covers = [];
  if (hr) { const cs = []; for (const fx of [0.1, 0.5, 0.9]) for (const fy of [0.1, 0.5, 0.9]) cs.push([hr.l + (hr.r - hr.l) * fx, hr.t + (hr.b - hr.t) * fy]); for (const [x, y] of cs) { const e = document.elementFromPoint(x, y); if (e && !h.contains(e)) covers.push(`${e.id || e.className || e.tagName}`.toString().slice(0, 30)); } }
  // text boxes inside the card that overlap each other (leaf elements with text)
  const leaves = h ? [...h.querySelectorAll('*')].filter((e) => vis(e) && e.children.length === 0 && (e.textContent || '').trim()) : [];
  const overlap = [];
  const rp = document.getElementById('reply') ? R(document.getElementById('reply')) : null;
  const clip = (e, r) => { const w = e.closest('#reply'); if (!w || !rp) return r; return { l: Math.max(r.l, rp.l), t: Math.max(r.t, rp.t), r: Math.min(r.r, rp.r), b: Math.min(r.b, rp.b) }; }; // what is scrolled out of the reply is not on screen
  for (let i = 0; i < leaves.length; i++) for (let j = i + 1; j < leaves.length; j++) { const a = clip(leaves[i], R(leaves[i])), b = clip(leaves[j], R(leaves[j])); if (a.r > a.l && a.b > a.t && b.r > b.l && b.b > b.t && hit(a, b)) overlap.push(`${leaves[i].textContent.trim().slice(0, 14)} / ${leaves[j].textContent.trim().slice(0, 14)}`); }
  const clipped = leaves.filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible' && !e.title).map((e) => e.textContent.trim().slice(0, 20));
  return { card: hr, win: [innerWidth, innerHeight], covers, overlap, clipped, pageScroll: document.documentElement.scrollHeight > innerHeight + 1 };
});
try {
  await new Promise((r) => setTimeout(r, 5000));
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message.slice(0, 100)));
  await page.goto(`http://localhost:${port}/?mode=editor&welcome=0${process.env.EXTRA ? '&' + process.env.EXTRA : ''}`);
  await page.waitForSelector('#view3d', { timeout: 90000 });
  await page.waitForFunction(() => Number(document.documentElement.dataset.pieces) >= 3, null, { timeout: 90000 });
  await page.waitForTimeout(2500);
  const cam = async () => JSON.parse(await page.evaluate(() => document.documentElement.dataset.cam));
  const shot = async (name) => { await page.screenshot({ path: `${out}/${tag}-${name}.png` }); const p = await probe(page); console.log(name, JSON.stringify(p)); return p; };
  // state 1: card open, empty
  if (!(await page.isVisible('#helper'))) await page.click('#helperbtn');
  await page.waitForTimeout(500);
  let p = await shot('1-open');
  check('card is inside the window', !!p.card && p.card.r <= 1280 && p.card.b <= 720 && p.card.l >= 0 && p.card.t >= 0);
  check('card sits in the bottom-right quarter', !!p.card && p.card.r >= 1280 - 20 && p.card.b >= 720 - 90);
  check('nothing covers the card', p.covers.length === 0, p.covers.join(','));
  check('no text boxes overlap in the card', p.overlap.length === 0, p.overlap.join(' | '));
  // state 2: a reply, plain and long
  await page.evaluate((t) => { const r = document.getElementById('reply'); r.className = 'reply'; r.textContent = t; }, `Try moving the second bar 0.4 m closer to the first. ${LONG}. The simulator says the lane then clears with a short jump, and the landing at ${LONG} stays soft.`);
  await page.waitForTimeout(300);
  p = await shot('2-long-reply');
  check('long reply: card still inside the window and scrolls itself', !!p.card && p.card.b <= 720 && p.card.t >= 0 && !p.pageScroll);
  check('long reply: no overlap', p.overlap.length === 0, p.overlap.join(' | '));
  // state 2b: a preview as the editor builds it (checkbox rows, a verdict and buttons), with a long place name in a row
  await page.evaluate((t) => { const r = document.getElementById('reply'); r.className = 'reply'; r.replaceChildren(); const add = (tag, o, par = r) => { const e = Object.assign(document.createElement(tag), o); par.append(e); return e; }; add('strong', { textContent: 'Fix it' }); add('div', { className: 'muted', textContent: 'The outlines show where things would go (grey: now, teal: after). Nothing changes until you press Apply.' }); for (const w of ['Move the second bar 0.4 m closer to the first bar.', `Lower the landing block next to ${t} by 0.3 m.`]) { const l = add('label', { className: 'pvrow' }); add('input', { type: 'checkbox', checked: true }, l); add('span', { textContent: w }, l); } add('div', { id: 'previewverdict', className: 'ok', textContent: 'After this change the lane clears.' }); const b = add('div', { className: 'row', id: 'previewbuttons' }); add('button', { textContent: 'Apply', className: 'go' }, b); add('button', { textContent: 'Cancel' }, b); }, LONG);
  await page.waitForTimeout(300);
  p = await shot('2b-preview');
  check('preview rows: no overlap, card inside', p.overlap.length === 0 && !!p.card && p.card.b <= 720 && p.card.t >= 0, p.overlap.join(' | '));
  // state 3: the Fix menu opens the card with advice
  await page.click('#fixmenubtn').catch(() => {}); await page.waitForTimeout(200);
  await page.click('#fixmenu-fixit').catch(() => {}); await page.waitForTimeout(1500);
  p = await shot('3-fixit');
  check('after Fix it: card inside, nothing covers it', !!p.card && p.card.b <= 720 && p.covers.length === 0, p.covers.join(','));
  await page.keyboard.press('Escape');
  // state 4: Moves card and the partner share one dock
  await page.click('#movesbtn').catch(() => {}); await page.waitForTimeout(300);
  await shot('4-moves');
  await page.click('#helperbtn').catch(() => {}); await page.waitForTimeout(300);
  // the wheel still zooms over the picture, also where the card is
  const box = await page.locator('#view3d').boundingBox();
  for (const [name, fx] of [['left of the card', 0.3], ['over the card', 0.92]]) {
    const c0 = await cam(); await page.mouse.move(box.x + box.width * fx, box.y + box.height * 0.8);
    for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, -100); await page.waitForTimeout(80); }
    await page.waitForTimeout(400); const c1 = await cam();
    if (fx < 0.5) check(`wheel ${name}: the camera comes nearer`, c1.d < c0.d * 0.8);
    else console.log(`info wheel ${name}: ${c0.d.toFixed(1)} -> ${c1.d.toFixed(1)} (over the card the wheel scrolls the card, by design)`);
  }
  check('no page errors', errs.length === 0, errs.join(' | '));
  await browser.close();
} catch (e) { console.log('FAIL error', e.message); results.push(false); }
server.kill();
process.exit(results.every(Boolean) && results.length ? 0 : 1);
