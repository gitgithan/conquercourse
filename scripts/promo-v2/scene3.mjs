// Promo storyboard scene 3 (CC-133): Build your course. One run in the World Editor: Shibuya slice, rotate/top/Fit, the bulb and bench course,
// Add pieces tabs, a canal railing moved somewhere weird, the Simulator says no, Improve > Ask AI, Apply, Moves > Find ways > Show it, Play this lane.
// usage: node scene3.mjs <playwright> <outdir> [baseUrl]      marks.json holds the beat marks (seconds of the capture); post-s3.mjs cuts, speeds up and adds the overlays.
// The Design partner reply is a scripted stand-in in the live JSON format (no model key on the capture machine); the panel, the preview and the simulator checks are the real app.
import { readFileSync, writeFileSync } from 'node:fs';
import { openSession } from './lib.mjs';
const [pw, out, base = 'http://localhost:5173'] = process.argv.slice(2);
const P = JSON.parse(readFileSync(new URL('./params/scene1.json', import.meta.url), 'utf8'));
const place = JSON.parse(readFileSync(new URL('../../' + P.placeFile, import.meta.url), 'utf8'));
const S = await openSession({ url: null, out, pw, rafStep: true, w: 1920, h: 1080, dsf: 1 }); const p = S.p;
const log = [];
const step = async (name, fn) => { try { const r = await fn(); log.push({ name, ok: true }); return r; } catch (e) { console.log('STEP FAILED', name, e.message.slice(0, 300)); log.push({ name, ok: false, err: e.message.slice(0, 200) }); return null; } };
p.on('dialog', (d) => d.accept().catch(() => {}));
await p.addInitScript(() => { try { localStorage.setItem('cc.next.seen', '1'); } catch { /* ok */ } });
const fix = { id: null, orig: null, now: null };
await p.route('**/api/designer', async (route) => {
  const dx = fix.orig && fix.now ? +(fix.orig.x - fix.now.x).toFixed(2) : 0, dz = fix.orig && fix.now ? +(fix.orig.z - fix.now.z).toFixed(2) : 0;
  const edits = [{ piece: fix.id, dx: Math.max(-10, Math.min(10, dx)), dz: Math.max(-10, Math.min(10, dz)) }];
  const reply = 'The new railing blocks the lane. Slide it back to where it sits beside the bench lane and the run clears again.\n```json\n' + JSON.stringify(edits) + '\n```';
  console.log('designer stand-in', JSON.stringify(edits));
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reply }) });
});
const worldPieces = () => p.evaluate(() => { try { return JSON.parse(localStorage.getItem('cc.world.v1')).pieces.map((q, i) => ({ id: i, name: q.src, x: q.x, z: q.z })); } catch { return []; } });
const clean = async () => {
  await S.hideChrome();
  if (await p.isVisible('#glossaryhide')) await p.click('#glossaryhide');
  if (await p.isVisible('#helper')) await p.click('#closehelper').catch(() => {});
};
const editorReady = async () => { await S.until(() => document.documentElement.dataset.ready === 'true' && !!document.querySelector('#view3d') && !!document.querySelector('#fitview'), 'editor ready', 240000); await S.settle(2500); await clean(); await S.settle(500); };

// ---- unrecorded: slice Shibuya and send it to the World Editor
await p.goto(base + P.url + `&lat=${place.lat}&lon=${place.lon}&z=16`);
await p.waitForFunction(() => document.documentElement.dataset.mapready === 'true' && window.__ccMap, null, { timeout: 180000 }).catch(() => console.log('map not ready'));
await S.settle(1500); await S.hideChrome();
await S.until(() => window.__ccMap.map.areTilesLoaded(), 'tiles', 60000);
const q = await p.evaluate(([lat, lon]) => { const m = window.__ccMap.map, r = m.getCanvas().getBoundingClientRect(), z = m.project([lon, lat]); return { x: r.left + z.x, y: r.top + z.y }; }, [place.lat, place.lon]);
await p.mouse.click(q.x, q.y); await S.settle(800);
await S.until(() => !document.querySelector('#slice').disabled, 'slice enabled', 120000);
await p.click('#slice');
await S.until(() => document.documentElement.dataset.flightDone === '1', 'flight', 600000);
await S.until(() => document.documentElement.dataset.sliceLane && document.documentElement.dataset.sliceLane !== 'working', 'lane', 300000);
await S.settle(1000);
await p.evaluate(() => document.querySelector('#buildpieces').scrollIntoView({ block: 'center' }));
await p.click('#buildpieces');
await editorReady();
console.log('editor at', await p.evaluate(() => location.search), await p.evaluate(() => [...document.querySelectorAll('[id]')].map((e) => e.id).slice(0, 60).join(',')));
await p.screenshot({ path: `${out}/debug-editor.png` });
S.n = 0; S.marks = {}; S.mx = 960; S.my = 450; await p.mouse.move(960, 450);

// ---- A. Choose your course
const box = await p.evaluate(() => { const r = document.querySelector('#view3d').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
S.mark('A0');
await S.rec(0.5);
await step('rotate', async () => { await S.glide(box.x + box.w * 0.5, box.y + 120, 0.3); await S.drag(280, 0, 1.2); });
await step('top', async () => { await S.clickSel('#viewmode', { move: 0.4, hold: 0.2, after: 0.5 }); await S.rec(0.4); });
await step('fit1', async () => { await S.clickSel('#fitview', { move: 0.4, hold: 0.2, after: 0.6 }); });
await step('3d', async () => { await S.clickSel('#viewmode', { move: 0.4, hold: 0.2, after: 0.8 }); });
S.mark('A1');
await step('preset', async () => {
  await S.glideTo('#presetpick', 0.5);
  await p.mouse.down(); await S.rec(0.25); await p.mouse.up(); await S.rec(0.1);
  S.mark('A2');   // reload follows: no pictures while it loads
  await p.selectOption('#presetpick', 'fork');
  await p.waitForNavigation({ timeout: 60000 }).catch(() => {});
  await editorReady();
});
S.mark('A3');
await step('fit2', async () => { await S.clickSel('#fitview', { move: 0.5, hold: 0.2, after: 0.9 }); });
S.mark('A4');

// ---- B. Add your objects
await step('addpieces', async () => { await S.clickSel('#addpiece', { move: 0.5, hold: 0.2, after: 0.6 }); await S.rec(0.4); });
S.mark('B0');
await step('tabs', async () => {
  const n = await p.locator('.pb-tab').count();
  for (let i = 1; i < n; i++) { const t = p.locator('.pb-tab').nth(i); const b = await t.boundingBox(); if (!b) continue; await S.pressAt(b.x + b.width / 2, b.y + b.height / 2, { move: 0.12, hold: 0.1, after: 0.2 }); await t.click(); }
});
S.mark('B1');
await step('railing', async () => {
  await p.locator('.pb-tab', { hasText: 'Real objects' }).first().click(); await S.rec(0.2);
  const card = p.locator('.pb-card[title="Canal railing"]').first();
  await card.scrollIntoViewIfNeeded(); await S.rec(0.1);
  const before = new Set((await p.evaluate(() => window.ccPieceScreen())).map((x) => x.id)); const nStored = (await worldPieces()).length; const nBefore = Number(await p.evaluate(() => document.documentElement.dataset.pieces || 0));
  await card.evaluate((e) => e.scrollIntoView({ block: 'center' })); await S.rec(0.2);
  const cb = await card.boundingBox(); console.log('card box', JSON.stringify(cb), 'mouse', S.mx, S.my);
  await card.hover(); await S.rec(0.4);
  await p.evaluate(([x, y]) => { const d = document.createElement('div'); d.style.cssText = `position:fixed;left:${x - 24}px;top:${y - 24}px;width:48px;height:48px;border-radius:50%;background:rgba(255,220,0,.55);border:3px solid #ffd400;z-index:2147483647;pointer-events:none`; document.body.appendChild(d); setTimeout(() => d.remove(), 600); }, [cb.x + cb.width / 2, cb.y + cb.height / 2]);
  await card.click(); await S.rec(0.3);
  await S.rec(0.2);
  await S.until(new Function(`return Number(document.documentElement.dataset.pieces || 0) > ${nBefore}`), 'piece added', 60000, false).catch(() => {});
  await S.settle(300);
  const sAdded = (await p.evaluate(() => window.ccPieceScreen())).filter((x) => !before.has(x.id));
  const all = await worldPieces(); const r = all.length > nStored ? all[all.length - 1] : null;
  console.log('added', JSON.stringify(sAdded), 'stored', nStored, '->', all.length, JSON.stringify(r)); fix.before = before; fix.id = sAdded[sAdded.length - 1]?.id; fix.idx = r?.id; fix.orig = r ? { x: r.x, z: r.z } : null;
});
S.mark('B2');
await step('move-weird', async () => {
  await p.keyboard.press('Escape').catch(() => {});
  await p.evaluate(() => document.getElementById('addpiece')?.click()); // close the menu if it is still open
  await p.keyboard.press('KeyF'); await S.rec(1.0);
  const sc = await p.evaluate(() => window.ccPieceScreen());
  if (fix.id == null) fix.id = sc.filter((x) => !fix.before.has(x.id)).pop()?.id;
  const mine = sc.find((s) => s.id === fix.id);
  const others = sc.filter((s) => s.id !== fix.id).sort((a, b) => a.x - b.x);
  console.log('screen pieces', JSON.stringify(sc));
  if (!mine) throw new Error('railing not on screen');
  const targets = [others[Math.floor(others.length / 2)], others[0], others[others.length - 1]].filter(Boolean);
  await S.glide(mine.x, mine.y, 0.5);
  for (let i = 0; i < targets.length; i++) {
    const cur = (await p.evaluate(() => window.ccPieceScreen())).find((s) => s.id === fix.id);
    if (i > 0) await S.glide(cur.x, cur.y, 0.3);
    const t = targets[i];
    await p.mouse.down(); await S.rec(0.15);
    const x0 = S.mx, y0 = S.my;
    await S.rec(1.0, async (u) => { const e = u * u * (3 - 2 * u); await p.mouse.move(x0 + (t.x - x0) * e, y0 + (t.y - y0) * e); });
    await p.mouse.up(); S.mx = t.x; S.my = t.y; await S.rec(0.3);
    const st = await p.evaluate(() => document.documentElement.dataset.laneClear);
    await S.until(() => document.documentElement.dataset.laneClear === '0', 'no solution', 60000);
    const cl = await p.evaluate(() => document.documentElement.dataset.laneClear);
    console.log('after drag', i, 'laneClear', st, '->', cl);
    if (cl === '0') break;
  }
  const ps = await worldPieces(); const r = ps.find((x) => x.id === fix.idx); fix.now = r ? { x: r.x, z: r.z } : null;
  console.log('railing now', JSON.stringify(fix.now));
});
const highlight = async (sel, secs) => {
  await p.evaluate((s) => { const e = document.querySelector(s); if (e) e.style.cssText += ';outline:5px solid #ffd400;outline-offset:3px;border-radius:8px'; }, sel);
  await S.glideTo(sel, 0.5, { fy: 0.3 }); await S.rec(secs);
  await p.evaluate((s) => { const e = document.querySelector(s); if (e) e.style.outline = ''; }, sel);
};
await step('sim-no', async () => { await S.rec(0.2); await highlight('#simsays-editor', 1.6); });
S.mark('B3');

// ---- C. Design partner suggests fixes
await step('improve', async () => { await S.clickSel('#fixmenubtn', { move: 0.5, hold: 0.2, after: 0.5 }); await S.rec(0.3); });
await step('askai', async () => {
  await S.clickSel('#fixmenu-what', { move: 0.5, hold: 0.2, after: 0.3 });
  S.mark('C1');
  await S.until(() => !!document.querySelector('#applyedits') || !!document.querySelector('#applypreview'), 'partner reply', 120000);
  S.mark('C2');
  await S.until(() => { const b = document.querySelector('#applyedits') || document.querySelector('#applypreview'); return !!b && !b.disabled; }, 'preview checked', 120000);
  S.mark('C3');
  await S.rec(1.8);
});
S.mark('C4');

// ---- D. Accept changes
await step('apply', async () => {
  const sel = (await p.locator('#applyedits').count()) ? '#applyedits' : '#applypreview';
  await S.clickSel(sel, { move: 0.5, hold: 0.2, after: 0.4 });
  await S.until(() => document.documentElement.dataset.laneClear === '1', 'clears again', 120000);
  await S.rec(0.2); await highlight('#simsays-editor', 1.5);
});
S.mark('D1');

// ---- E. Add moves by tweaking obstacles
await step('moves', async () => {
  await S.clickSel('#movesbtn', { move: 0.5, hold: 0.2, after: 0.5 });
  await S.clickSel('#findways', { move: 0.5, hold: 0.2, after: 0.2 });
  S.mark('E1');                                                       // the wait is cut after filming
  await S.until(() => !document.querySelector('#stopways') && document.querySelectorAll('#moves button.go, #moves .sg button').length > 0, 'find ways', 600000);
  S.mark('E2');
  await S.rec(0.3);
  const b = p.locator('#moves .sg button', { hasText: 'Show it' }).first();
  if (await b.count()) { await S.clickSel('#moves .sg button.go', { move: 0.5, hold: 0.2, after: 0.4 }); await S.rec(1.0); }
  const sc = await p.evaluate(() => window.ccPieceScreen?.() ?? []);
  if (sc.length) { const t = sc[Math.floor(sc.length / 2)]; await S.glide(t.x, t.y, 0.6); await S.rec(0.5); }
});
S.mark('E3');
await step('close', async () => {
  await p.keyboard.press('Escape').catch(() => {});
  if (await p.isVisible('#closemoves')) await S.clickSel('#closemoves', { move: 0.4, hold: 0.15, after: 0.2 });
  if (await p.isVisible('#closehelper')) await S.clickSel('#closehelper', { move: 0.4, hold: 0.15, after: 0.2 });
});
await step('play', async () => { await S.clickSel('#play', { move: 0.5, hold: 0.3, after: 0.3 }); });
S.mark('F0');

// ---- the transition: the prepared "Bench lane or bulb lane" course (owner, 2026-11-05), not the course built above
await step('prepared', async () => {
  await p.goto(base + '/?course=/assets/demo/fork-bench-bulb.course.json&bot=ideal&welcome=0&nosave=1&backend=webgl2&sunat=noon');
  await p.waitForSelector('html[data-ready=true]', { timeout: 240000 });
  await p.waitForTimeout(1500); await S.hideChrome(); await p.keyboard.press('KeyH').catch(() => {});
  S.mark('F1');
  await S.rec(2.0);
});
S.mark('end');
await S.finish({ steps: log, fix });
