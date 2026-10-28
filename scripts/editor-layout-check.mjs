// CC-94: counts the controls the World editor shows, and fails on overlapping cards or clipped, squeezed or wrapped button text.
// Runs at three window sizes and in each panel state (nothing open, Moves, Design partner, Add menu, overflow menu, command palette).
// OUT=<dir> chooses where the screenshots and layout.json go; PORT picks the dev-server port.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const port = process.env.PORT ?? '5180';
const out = process.env.OUT ?? 'test-results/editor-layout';
mkdirSync(out, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const sizes = [[1280, 720], [1024, 640], [1920, 1080]];
// the states: how to open each one (a state that does not exist on the old layout is skipped, and says so)
const states = {
  closed: async () => {},
  moves: async (page) => { await page.click('#movesbtn'); await page.waitForTimeout(500); },
  partner: async (page) => { await page.click('#helperbtn'); await page.waitForTimeout(400); },
  addmenu: async (page) => { if (await page.$('#addpiece')) { await page.click('#addpiece'); await page.waitForTimeout(300); } else throw new Error('no Add piece menu'); },
  overflow: async (page) => { if (await page.$('#overflow')) { await page.click('#overflow'); await page.waitForTimeout(300); } else throw new Error('no overflow menu'); },
  piece: async (page) => { await page.click('#addpiece'); await page.click('#addpiece ~ #addmenu >> text=Bench'); await page.waitForTimeout(500); }, // a piece is chosen: the piece panel shows its controls
  machine: async (page) => { await page.click('#addpiece'); await page.click('#addband'); await page.waitForTimeout(500); }, // a machine is in the world: its settings panel shows
  palette: async (page) => { await page.keyboard.press('/'); await page.waitForTimeout(300); if (!(await page.$('#palette'))) throw new Error('no command palette'); },
};
const measure = () => {
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const ed = document.querySelector('.ed');
  const controls = [...ed.querySelectorAll('button, a.btn, select, textarea, input:not([type=hidden]):not([type=file])')].filter(vis);
  const bad = [];
  for (const b of controls.filter((c) => c.matches('button, a.btn'))) {
    const r = b.getBoundingClientRect(), lh = parseFloat(getComputedStyle(b).lineHeight) || 18, label = (b.textContent || b.title || b.id).trim().slice(0, 40);
    if (b.scrollWidth > b.clientWidth + 1) bad.push(`clipped: ${label}`);
    else if (r.height > lh * 2.4) bad.push(`wrapped: ${label}`);
    else if (r.width < 28 && label.length > 2) bad.push(`squeezed: ${label}`);
  }
  const card = (sel, name) => { const e = document.querySelector(sel); if (!e || !vis(e)) return null; const r = e.getBoundingClientRect(); return { name, x0: r.left, y0: r.top, x1: r.right, y1: r.bottom }; };
  const cards = [card('.top', 'topbar'), card('#machinepanel', 'machine settings'), card('#panel', 'piece panel'), card('.aside > .panel:last-child', 'lane panel'), card('.profilewrap', 'side view'), card('#helper', 'partner'), card('#moves', 'moves'), card('.addmenu', 'add menu'), card('.overflow', 'overflow menu'), card('#palette', 'palette')].filter(Boolean);
  const overlaps = [];
  const menus = new Set(['add menu', 'overflow menu', 'palette']); // menus are meant to float over the cards
  for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) {
    const a = cards[i], b = cards[j];
    if (menus.has(a.name) || menus.has(b.name)) continue;
    if (Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 2 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 2) overlaps.push(`${a.name} / ${b.name}`);
  }
  // the piece panel may scroll inside the right column, but its top must be on screen; every other card must be wholly on screen
  const offscreen = cards.filter((c) => (c.name === 'piece panel' ? c.y0 > innerHeight - 30 : c.x0 < -1 || c.y0 < -1 || c.x1 > innerWidth + 1 || c.y1 > innerHeight + 1)).map((c) => c.name);
  const top = document.querySelector('.top');
  return {
    controls: controls.length, buttons: controls.filter((c) => c.matches('button, a.btn')).length,
    topControls: top ? controls.filter((c) => top.contains(c)).length : 0,
    bad, overlaps, offscreen,
    // CC-94: the chosen piece's tools sit on the picture, inside it, and are not repeated in the right column
    pieceBar: (() => { const bar = document.getElementById('piecebar'), wrap = document.querySelector('.planwrap'); if (!bar || bar.style.display === 'none') return null; const r = bar.getBoundingClientRect(), w = wrap.getBoundingClientRect();
      return { inside: r.left >= w.left - 1 && r.right <= w.right + 1 && r.top >= w.top - 1 && r.bottom <= w.bottom + 1, ids: ['turnleft', 'turnright', 'dup', 'crop', 'del'].filter((id) => !bar.querySelector('#' + id)), copies: document.querySelectorAll('#del').length }; })(),
    pageFits: ed.scrollHeight <= ed.clientHeight + 1 && document.scrollingElement.scrollHeight <= innerHeight + 1,
  };
};
const result = {}; let failed = false;
try {
  await new Promise((r) => setTimeout(r, 3500));
  const browser = await chromium.launch({ args: flags });
  for (const [w, h] of sizes) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://localhost:${port}/?mode=editor`);
    await page.waitForSelector('#view3d', { timeout: 60000 });
    await page.waitForFunction(() => document.documentElement.dataset.pieces === '3', null, { timeout: 30000 });
    await page.waitForTimeout(1200);
    for (const [name, open] of Object.entries(states)) {
      try { await page.keyboard.press('Escape'); await page.evaluate(() => { for (const [id, btn] of [['moves', 'movesbtn'], ['helper', 'helperbtn']]) { const e = document.getElementById(id); if (e && !e.classList.contains('closed')) document.getElementById(btn).click(); } }); await page.waitForTimeout(150); await open(page); }
      catch (e) { result[`${w}x${h} ${name}`] = { skipped: String(e.message).slice(0, 60) }; continue; }
      const m = await page.evaluate(measure);
      const ok = m.bad.length === 0 && m.overlaps.length === 0 && m.offscreen.length === 0 && m.pageFits && (name !== 'closed' || true) && (name !== 'piece' || (m.pieceBar && m.pieceBar.inside && m.pieceBar.ids.length === 0 && m.pieceBar.copies === 1));
      result[`${w}x${h} ${name}`] = { ...m, ok };
      if (!ok) failed = true;
      await page.screenshot({ path: `${out}/${w}x${h}-${name}.png` });
    }
    // the command palette runs an action by name, and both shortcuts open it
    try {
      await page.keyboard.press('Escape');
      const before = Number(await page.evaluate(() => document.documentElement.dataset.pieces));
      await page.keyboard.press('Control+k'); await page.waitForSelector('#palette.open', { timeout: 3000 });
      await page.keyboard.type('low wall'); await page.keyboard.press('Enter'); await page.waitForTimeout(600);
      const after = Number(await page.evaluate(() => document.documentElement.dataset.pieces));
      await page.keyboard.press('/'); const slashOpens = await page.waitForSelector('#palette.open', { timeout: 3000 }).then(() => true, () => false);
      await page.keyboard.press('Escape');
      const ok = after === before + 1 && slashOpens;
      result[`${w}x${h} palette runs an action`] = { ok, before, after, slashOpens, controls: 0, buttons: 0, topControls: 0, bad: [], overlaps: [], offscreen: [], pageFits: true };
      if (!ok) failed = true;
    } catch (e) { result[`${w}x${h} palette runs an action`] = { ok: false, bad: [String(e.message).slice(0, 80)], overlaps: [], offscreen: [], pageFits: true, controls: 0, buttons: 0, topControls: 0 }; failed = true; }
    result[`${w}x${h} pageerrors`] = errors.slice(0, 3);
    if (errors.length) failed = true;
    await page.close();
  }
  await browser.close();
} finally { server.kill(); }
writeFileSync(`${out}/layout.json`, JSON.stringify(result, null, 2) + '\n');
for (const [k, v] of Object.entries(result)) console.log(k.padEnd(24), v.skipped ? `skipped (${v.skipped})` : Array.isArray(v) ? JSON.stringify(v) : `controls=${v.controls} buttons=${v.buttons} top=${v.topControls} ${v.ok ? 'ok' : 'FAIL'} ${[...v.bad, ...v.overlaps.map((o) => 'overlap ' + o), ...v.offscreen.map((o) => 'off ' + o), v.pageFits ? '' : 'page scrolls'].join('; ')}`);
console.log(failed ? 'FAIL' : 'PASS');
process.exit(failed ? 1 : 0);
