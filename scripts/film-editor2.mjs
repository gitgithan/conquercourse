// Records the real World Editor screen for the owner's cut (CC-209): the hero start scene on Montmartre, Fit, add a bar and a block from the Add pieces menu, drag the new piece, open the Design partner and run Fix it so its proposal shows.
// Playwright records in real time; the marks file says when each step happened (seconds from the start) so the film can pick windows without the waits.
// Usage: PORT=5291 node scripts/film-editor2.mjs [out.mp4]       (one browser at a time)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
const port = process.env.PORT ?? '5291', out = process.argv[2] ?? 'films/ui-editor2.mp4';
const work = `${out}.frames`; rmSync(work, { recursive: true, force: true }); mkdirSync(work, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const marks = []; const log = (m) => console.log(new Date().toISOString().slice(11, 19), m);
let t0 = 0, browser, ctx;
const pieceCount = (page) => page.evaluate(() => Number(document.documentElement.dataset.pieces ?? -1));
try {
  await new Promise((r) => setTimeout(r, 3000));
  browser = await chromium.launch({ args: flags });
  ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: work, size: { width: 1280, height: 720 } } });
  const page = await ctx.newPage(); t0 = Date.now();
  page.setDefaultTimeout(12000); // no click may wait forever: a missing control must fail fast, not hang the take
  page.on('pageerror', (e) => log('PAGEERROR ' + e.message.slice(0, 160)));
  const mark = (n) => { marks.push([n, (Date.now() - t0) / 1000]); log(n); };
  await page.goto(`http://localhost:${port}/?mode=editor&start=hero:montmartre-paris`);
  await page.waitForSelector('#view3d', { timeout: 120000 }); mark('editor open'); await page.waitForTimeout(3500);
  // the help card ("What these buttons do") and the person label cover the view: close both.
  // The card's Hide is not a real <button>, so find it by its text inside the card and click its centre.
  const hidePt = await page.evaluate(() => {
    const head = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && e.textContent.trim() === 'What these buttons do');
    if (!head) return null;
    let card = head; for (let i = 0; i < 6 && card; i++) card = card.parentElement;
    const hide = [...(card?.querySelectorAll('*') ?? [])].find((e) => e.children.length === 0 && e.textContent.trim() === 'Hide');
    if (!hide) return null;
    const r = hide.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (hidePt) { await page.mouse.click(hidePt.x, hidePt.y); await page.waitForTimeout(800); }
  const hides = await page.getByRole('button', { name: 'Hide', exact: true }).all();
  for (const h of hides) { await h.click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(500); }
  mark('help hidden'); await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}.0-open.png` });
  await page.getByRole('button', { name: 'Fit', exact: true }).click(); mark('fit clicked');
  await page.waitForTimeout(3500); await page.screenshot({ path: `${out}.1-fit.png` });
  // add a bar, then a block, from the one Add pieces menu (CC-94); the menu items keep their editor ids (#addbar, #add-block)
  const addViaMenu = async (label, idFallback) => {
    const before = await pieceCount(page);
    await page.getByRole('button', { name: '+ Add pieces' }).click({ timeout: 8000 }).catch(() => log('Add pieces button click failed')); mark('add menu opened'); await page.waitForTimeout(800);
    await page.locator(idFallback).click({ timeout: 3500 }).catch(async () => {
      log(`${idFallback} not clickable in the menu; forcing a DOM click`);
      await page.evaluate((sel) => document.querySelector(sel)?.click(), idFallback);
    });
    await page.waitForFunction((n) => Number(document.documentElement.dataset.pieces ?? -1) > n, before, { timeout: 15000 }).catch(() => log(`piece count did not rise for ${label}`));
    mark(`added ${label} (pieces ${before} -> ${await pieceCount(page)})`); await page.waitForTimeout(1800);
  };
  await addViaMenu('Bar', '#addbar');
  await addViaMenu('Block', '#add-block');
  // pieces move in the Top plan (a drag on the 3D view only turns the camera), so: plan, fit, drag the newest piece, back to 3D
  await page.click('#viewmode'); mark('top plan'); await page.waitForTimeout(700);
  await page.click('#fitview'); await page.waitForTimeout(1500);
  const spots = await page.evaluate(() => window.ccPieceScreen());
  const target = spots[spots.length - 1];
  if (target) {
    await page.mouse.move(target.x, target.y); await page.mouse.down();
    await page.mouse.move(target.x + 45, target.y + 15, { steps: 14 }); await page.mouse.up();
    await page.waitForTimeout(700);
    const afterDrag = await page.evaluate(() => window.ccPieceScreen());
    const moved = afterDrag.find((p) => p.id === target.id);
    log(`plan drag piece ${target.id}: ${Math.round(target.x)},${Math.round(target.y)} -> ${moved ? `${Math.round(moved.x)},${Math.round(moved.y)}` : 'gone'}`);
    mark('piece moved in plan'); await page.waitForTimeout(1500);
  } else log('no piece to move');
  await page.click('#viewmode'); mark('back to 3d'); await page.waitForTimeout(1000);
  await page.click('#fitview'); await page.waitForTimeout(2800); await page.screenshot({ path: `${out}.2-added.png` });
  // the Design partner beat is its own take (scripts/film-editor3.mjs, the broken ready-made course); the film splices it in here
  await page.waitForTimeout(2000);
  mark('end');
} catch (e) { log('threw ' + String(e).slice(0, 300)); }
// always close, or node stays alive holding the browser and the video never finalises
await ctx?.close().catch(() => {});
await browser?.close().catch(() => {});
server.kill();
writeFileSync(`${out}.marks.json`, JSON.stringify(marks, null, 2) + '\n');
console.log('video in', work, 'marks', JSON.stringify(marks));
process.exit(0);
