// Shot 3 "Design your course" (CC-143): the real World Editor at 1280x720, recorded in real time with a marks file;
// the long waits (3D drawing, the Design partner answer) are cut out afterwards from the marks, so every action stays visible.
// usage: node shot3.mjs <playwright> <outdir> <spec.json>   spec: {url}
import { readFileSync, writeFileSync } from 'node:fs';
const [pw, out, specFile] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specFile, 'utf8'));
const { chromium } = await import(pw);
const b = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl-egl'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: out, size: { width: 1280, height: 720 } } });
const p = await ctx.newPage(); const t0 = Date.now(); p.setDefaultTimeout(15000);
const marks = []; const mark = (n) => { marks.push([n, (Date.now() - t0) / 1000]); console.error('mark', n, ((Date.now() - t0) / 1000).toFixed(1)); };
p.on('pageerror', (e) => console.error('pageerror', e.message.slice(0, 160)));
const pieces = () => p.evaluate(() => Number(document.documentElement.dataset.pieces ?? 0));
const hideCards = async () => {
  const pt = await p.evaluate(() => { const head = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && e.textContent.trim() === 'What these buttons do'); if (!head) return null; let c = head; for (let i = 0; i < 6 && c; i++) c = c.parentElement; const h = [...(c?.querySelectorAll('*') ?? [])].find((e) => e.children.length === 0 && e.textContent.trim() === 'Hide'); if (!h) return null; const r = h.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  if (pt) { await p.mouse.click(pt.x, pt.y); await p.waitForTimeout(600); }
  for (const h of await p.getByRole('button', { name: 'Hide', exact: true }).all()) { await h.click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(300); }
};
const glide = async (x, y, steps = 25) => { await p.mouse.move(x, y, { steps }); };
await p.goto(spec.url);
await p.waitForSelector('#view3d', { timeout: 120000 }); await p.waitForTimeout(4000);
await p.addStyleTag({ content: '#cc-feedback-btn{display:none!important} #sitenav{z-index:1!important}' });
await p.evaluate(() => document.querySelectorAll('button').forEach((x) => { if (/^Feedback/.test(x.textContent.trim())) x.style.display = 'none'; }));
p.on('dialog', (d) => d.accept());
await p.selectOption('#presetpick', 'passing'); await p.waitForTimeout(1500);
await p.waitForSelector('#view3d', { timeout: 120000 }); await p.waitForFunction(() => Number(document.documentElement.dataset.pieces ?? 0) >= 4, null, { timeout: 60000 }).catch(() => console.error('preset slow')); await p.waitForTimeout(4000);
await p.addStyleTag({ content: '#cc-feedback-btn{display:none!important} #sitenav{z-index:1!important}' });
await hideCards(); await p.click('#fitview').catch(() => {}); await p.waitForTimeout(2500); mark('ready');
const addCard = async (name, last = false) => { try {
  const n = await pieces();
  await p.click('#lane-cancel', { timeout: 1500 }).catch(() => {});
  if (!(await p.getByRole('button', { name: 'Real objects' }).isVisible().catch(() => false))) { await p.getByRole('button', { name: '+ Add pieces' }).click(); await p.waitForTimeout(900); }
  mark('menu ' + name);
  await p.fill('#piecesearch', name.toLowerCase()).catch((e) => console.error('search', e.message.split('\n')[0])); await p.waitForTimeout(900);
  const bb = await p.evaluate((nm) => { const menuLeaf = [...document.querySelectorAll('button *, button')].filter((e) => e.children.length === 0 && e.textContent.trim() === nm).pop(); if (!menuLeaf) return null; let c = menuLeaf; while (c && !(c.getBoundingClientRect().width > 100 && c.getBoundingClientRect().height > 80)) c = c.parentElement; if (!c) return null; const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }, name);
  await p.waitForTimeout(500);
  const bb2 = bb && await p.evaluate((nm) => { const l = [...document.querySelectorAll('button *, button')].filter((e) => e.children.length === 0 && e.textContent.trim() === nm).pop(); let c = l; while (c && !(c.getBoundingClientRect().width > 100 && c.getBoundingClientRect().height > 80)) c = c.parentElement; const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }, name);
  if (bb2) { await glide(bb2.x + bb2.width / 2, bb2.y + bb2.height / 2, 20); await p.waitForTimeout(600); await p.mouse.click(bb2.x + bb2.width / 2, bb2.y + bb2.height / 2); } else console.error('no card', name);
  await p.waitForFunction((k) => Number(document.documentElement.dataset.pieces ?? 0) > k, n, { timeout: 3500 }).catch(async () => { console.error('retry by DOM click', name); await p.evaluate((nm) => { const l = [...document.querySelectorAll('button *, button')].filter((e) => e.children.length === 0 && e.textContent.trim() === nm).pop(); (l?.closest('button') ?? l)?.click(); }, name); });
  await p.waitForFunction((k) => Number(document.documentElement.dataset.pieces ?? 0) > k, n, { timeout: 6000 }).catch(() => console.error('count did not rise', name));
  mark('added ' + name); await p.waitForTimeout(1200);
  if (last && await p.getByRole('button', { name: 'Real objects' }).isVisible().catch(() => false)) { await p.getByRole('button', { name: '+ Add pieces' }).click(); await p.waitForTimeout(700); }
 } catch (e) { console.error('addCard failed', name, e.message.split('\n')[0]); await p.screenshot({ path: out + '/fail-' + name.replace(/ /g, '_') + '.png' }).catch(() => {}); } };
// 1. the library: three pieces made from photos, each with its picture
await addCard('Concrete planter');
// 2. resize the chosen piece from its Size and height card
await p.evaluate(() => { const s = [...document.querySelectorAll('summary')].find((x) => /Size and height/.test(x.textContent)); s?.scrollIntoView({ block: 'center' }); s?.click(); }); await p.waitForTimeout(900); mark('size card open'); console.error('SIZEDOM', await p.evaluate(() => { const s = [...document.querySelectorAll('summary')].find((x) => /Size and height/.test(x.textContent)); return (s?.parentElement?.outerHTML ?? 'none').slice(0, 900); }));
const rng = await p.evaluate(() => { const s = [...document.querySelectorAll('summary')].find((x) => /Size and height/.test(x.textContent)); const r = s?.parentElement?.querySelector('input[type=range]'); if (!r) return null; const b = r.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
if (rng) { await glide(rng.x + rng.w * 0.4, rng.y + rng.h / 2, 15); await p.mouse.down(); await glide(rng.x + rng.w * 0.8, rng.y + rng.h / 2, 20); await p.mouse.up(); mark('resized'); } else console.error('no size slider');
await p.waitForTimeout(900);
await addCard('Iron railing');
await addCard('Skate platform', true);
// 3. top plan: drag the newest piece
await p.click('#viewmode'); mark('top plan'); await p.waitForTimeout(900); await p.click('#fitview'); await p.waitForTimeout(1500);
const spots = await p.evaluate(() => window.ccPieceScreen?.() ?? []); const t = spots[spots.length - 1];
if (t) { await glide(t.x, t.y, 12); await p.mouse.down(); await glide(t.x + 70, t.y + 20, 18); await p.mouse.up(); mark('dragged'); } else console.error('no piece spots');
await p.waitForTimeout(900);
// 4. back to 3D, Fit, orbit from far to near
await p.click('#viewmode'); mark('3d'); await p.waitForTimeout(900); await p.click('#fitview'); await p.waitForTimeout(1500);
const box = await p.evaluate(() => { const r = document.querySelector('#view3d').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
const cx = box.x + box.w / 2, cy = box.y + box.h * 0.6;
await p.mouse.move(cx, cy); for (let i = 0; i < 4; i++) { await p.mouse.wheel(0, 240); await p.waitForTimeout(250); } mark('far');
await p.mouse.down(); await glide(cx + 180, cy - 30, 40); await p.mouse.up(); mark('orbited');
for (let i = 0; i < 5; i++) { await p.mouse.wheel(0, -200); await p.waitForTimeout(250); } await p.waitForTimeout(800); await p.click('#fitview').catch(() => {}); await p.waitForTimeout(1500); mark('near');
// 5. the Design partner
await p.getByRole('button', { name: 'Design partner' }).first().click(); await p.waitForTimeout(1200); mark('partner open');
await p.evaluate(() => document.querySelector('#what')?.click()); mark('asked');
await p.waitForFunction(() => document.querySelector('#send') && !document.querySelector('#what')?.disabled, null, { timeout: 60000 }).catch(() => {}); await p.waitForTimeout(6000); mark('answered');
writeFileSync(out + '/marks.json', JSON.stringify(marks, null, 2));
console.log(JSON.stringify({ start: 0, end: (Date.now() - t0) / 1000, marks }));
await ctx.close(); await b.close();
