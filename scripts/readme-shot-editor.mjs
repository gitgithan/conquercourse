// CC-133: the four pictures for the README "World Editor" screen, each saved as its own 1920 x 1020 picture in README_MEDIA/.
// All four use the same course: the ready-made "Hang bar and Lache (clears)", with one deck dragged along so the course no longer clears.
//   tile 1: 3D view fitted and turned (start point and hang bar in view); Improve > Ask AI for ideas; wait for the design partner and its teal suggestions; Improve menu open again
//   tile 2: the same course from the top (Top plan)
//   tile 3: the same course with "+ Add pieces" open on its default Real objects tab
//   tile 4: the same course with the Moves chip pressed ("Moves in this world")
// Usage: PORT=5461 node scripts/readme-shot-editor.mjs [tile1|tile2|tile3|tile4|all] [outDir]   (a Vite dev server must already run on PORT; it answers /api/designer with the owner's key)
// W / H change the picture size for quick trials. ROT="dx,dy" is the mouse drag that turns the 3D view; MOVE_PX is how far the deck is dragged.
// To add a screen, append to TILES. One browser at a time. Nothing is faked: the partner's answer is the real one; if it fails, the shot says so and the text of the failure is printed.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const port = process.env.PORT ?? '5461', which = process.argv[2] ?? 'all', out = process.argv[3] ?? 'README_MEDIA';
mkdirSync(out, { recursive: true });
const W = Number(process.env.W ?? 1920), H = Number(process.env.H ?? 1020);
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const sleep = (p, ms) => p.waitForTimeout(ms);

async function setup(browser) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H } }), page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 160)));
  page.on('dialog', (d) => void d.accept());
  await page.addInitScript(() => { try { localStorage.setItem('cc.next.seen', '1'); localStorage.setItem('cc.editor.glossary', 'hidden'); } catch { /* ok */ } });
  await page.goto(`http://localhost:${port}/?mode=editor`, { timeout: 240000 });
  await page.waitForSelector('#presetpick', { timeout: 240000 });
  await page.selectOption('#presetpick', 'swing'); // the page reloads on the saved course
  await page.waitForLoadState('load'); await sleep(page, 1500);
  await page.waitForSelector('#presetpick', { timeout: 240000 });
  await page.waitForFunction(() => document.documentElement.dataset.pieces && (window.ccPieceScreen?.().length ?? 0) > 3, null, { timeout: 120000 });
  await page.click('#fitview'); await sleep(page, 1500);
  // turn the 3D view (left-drag on empty ground) until the start and the hang bar can be seen at a slant, like the Course's 45 degree view
  const [rx, ry] = (process.env.ROT ?? '0,0').split(',').map(Number), c = page.locator('#plan').first();
  const box = await page.evaluate(() => { const r = document.querySelector('.planwrap canvas:not(#plan)')?.getBoundingClientRect() ?? document.querySelector('.planwrap').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const sx = box.x + box.w * 0.5, sy = box.y + box.h * 0.9; // an empty spot near the bottom edge of the picture
  if (rx || ry) { await page.mouse.move(sx, sy); await page.mouse.down(); await page.mouse.move(sx + rx, sy + ry, { steps: 12 }); await page.mouse.up(); await sleep(page, 800); await page.click('#fitview'); await sleep(page, 1500); }
  // move a block so the course breaks: drag the middle deck along the course
  const ps = await page.evaluate(() => window.ccPieceScreen());
  console.log('pieces on screen', JSON.stringify(ps.map((p) => [p.id, Math.round(p.x), Math.round(p.y)])));
  const pick = ps[Number(process.env.MOVE_ID ?? 5)] ?? ps[1], mv = Number(process.env.MOVE_PX ?? 150), dir = (process.env.MOVE_DIR ?? '0.987,-0.163').split(',').map(Number);
  await page.mouse.move(pick.x, pick.y); await page.mouse.down(); await page.mouse.move(pick.x + dir[0] * mv, pick.y + dir[1] * mv, { steps: 12 }); await page.mouse.up();
  await sleep(page, 2500); // the simulator checks the changed course
  await page.waitForFunction(() => !/I am checking this lane/.test(document.body.innerText), null, { timeout: 300000 }).catch(() => console.log('CHECK WAIT TIMED OUT'));
  await sleep(page, 1000);
  console.log('simulator says:', JSON.stringify((await page.evaluate(() => document.body.innerText.match(/(I can clear|I cannot|I could not|No path|can.t clear)[^\n]*/i)?.[0] ?? '(no verdict line)'))));
  console.log('verdict', await page.evaluate(() => document.documentElement.dataset.verdict ?? document.documentElement.dataset.laneClear ?? ''));
  return page;
}

const TILES = {
  tile1: { file: 'editor-1-improve-menu-after-ai-ideas', run: async (b) => {
    const p = await setup(b);
    await p.click('#fixmenubtn'); await p.click('#fixmenu-what');
    const t0 = Date.now();
    await p.waitForFunction(() => { const r = document.getElementById('reply')?.textContent ?? ''; return /suggested|could not answer|switched off/.test(r) || !!document.getElementById('applyedits'); }, null, { timeout: Number(process.env.AI_WAIT_MS ?? 240000) }).catch(() => console.log('AI WAIT TIMED OUT'));
    console.log('reply after', Date.now() - t0, 'ms:', JSON.stringify(await p.evaluate(() => document.getElementById('reply')?.textContent ?? '')));
    if (await p.$('#applyedits')) { await p.click('#applyedits'); await sleep(p, 2500); } // the teal suggested moves appear on the picture once the preview check ends
    await p.waitForFunction(() => !/checking proposed changes/i.test(document.body.innerText), null, { timeout: 300000 }).catch(() => console.log('PREVIEW WAIT TIMED OUT'));
    await sleep(p, 1500); await p.click('#fixmenubtn'); await sleep(p, 800);
    return p;
  } },
  tile2: { file: 'editor-2-top-view', run: async (b) => { const p = await setup(b); await p.click('#viewmode'); await sleep(p, 2000); return p; } },
  tile3: { file: 'editor-3-add-pieces', run: async (b) => { const p = await setup(b); await p.click('#addpiece'); await sleep(p, 2500); return p; } },
  tile4: { file: 'editor-4-moves', run: async (b) => { const p = await setup(b); await p.click('#movesbtn'); await sleep(p, 2000); return p; } },
};

const browser = await chromium.launch({ args: flags });
try {
  for (const [name, t] of Object.entries(TILES)) {
    if (which !== 'all' && which !== name) continue;
    const page = await t.run(browser);
    await page.screenshot({ path: `${out}/${t.file}.png`, timeout: 600000 });
    console.log(name, 'saved', `${out}/${t.file}.png`);
    await page.context().close();
  }
} finally { await browser.close(); }
