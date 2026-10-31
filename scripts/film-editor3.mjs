// Records the Design partner beat for the owner's cut (CC-209): load the ready-made "Broken park (needs Fix it)" course in the World Editor, run Fix it, show its proposal, then Apply so the pieces move.
// Split from film-editor2.mjs so a slow Fix search cannot spoil the adds/move take; the film splices the two takes.
// The partner card starts open (the top-bar button toggles it shut), so Fix it is clicked by id in the DOM, not by hunting on screen.
// Playwright records in real time; the marks file says when each step happened (seconds from the start) so the film can pick windows without the waits.
// Usage: PORT=5291 node scripts/film-editor3.mjs [out.mp4]       (one browser at a time)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
const port = process.env.PORT ?? '5291', out = process.argv[2] ?? 'films/ui-editor3.mp4';
const work = `${out}.frames`; rmSync(work, { recursive: true, force: true }); mkdirSync(work, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const marks = []; const log = (m) => console.log(new Date().toISOString().slice(11, 19), m);
let t0 = 0, browser, ctx;
try {
  await new Promise((r) => setTimeout(r, 3000));
  browser = await chromium.launch({ args: flags });
  ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: work, size: { width: 1280, height: 720 } } });
  const page = await ctx.newPage(); t0 = Date.now();
  page.setDefaultTimeout(12000);
  page.on('pageerror', (e) => log('PAGEERROR ' + e.message.slice(0, 160)));
  page.on('dialog', (d) => d.accept()); // the preset picker asks "replace the pieces?" before loading
  const mark = (n) => { marks.push([n, (Date.now() - t0) / 1000]); log(n); };
  const hideOverlays = async () => {
    const hidePt = await page.evaluate(() => {
      const head = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && e.textContent.trim() === 'What these buttons do');
      if (!head) return null;
      let card = head; for (let i = 0; i < 6 && card; i++) card = card.parentElement;
      const hide = [...(card?.querySelectorAll('*') ?? [])].find((e) => e.children.length === 0 && e.textContent.trim() === 'Hide');
      if (!hide) return null;
      const r = hide.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (hidePt) { await page.mouse.click(hidePt.x, hidePt.y); await page.waitForTimeout(700); }
    const hides = await page.getByRole('button', { name: 'Hide', exact: true }).all();
    for (const h of hides) { await h.click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(400); }
  };
  // start from the plain editor: from the hero URL the start scene would be rebuilt on the preset's reload and win over the chosen course
  await page.goto(`http://localhost:${port}/?mode=editor&welcome=0`);
  await page.waitForSelector('#view3d', { timeout: 120000 }); mark('editor open'); await page.waitForTimeout(3000);
  await hideOverlays(); mark('help hidden');
  // the broken ready-made course (CC-243: it exists so Fix it has something real to repair)
  await page.selectOption('#presetpick', 'failing'); mark('broken course chosen');
  await page.waitForSelector('#view3d', { timeout: 120000 });
  await page.waitForFunction(() => Number(document.documentElement.dataset.pieces ?? 0) >= 4, null, { timeout: 60000 }).catch(() => log('preset pieces slow'));
  await page.waitForTimeout(3000);
  await hideOverlays();
  await page.click('#fitview'); mark('fit clicked'); await page.waitForTimeout(2800);
  await page.screenshot({ path: `${out}.0-broken.png` });
  // Fix it, in its own card: scroll the card into view, then click by id (screen clicks on the card proved flaky under load)
  await page.evaluate(() => document.querySelector('#helper')?.scrollIntoView({ block: 'center' })); await page.waitForTimeout(1000);
  await page.evaluate(() => { delete document.documentElement.dataset.fixed; document.querySelector('#fixit')?.click(); });
  mark('fix it clicked');
  await page.waitForFunction(() => document.documentElement.dataset.fixed !== undefined, null, { timeout: 150000 }).catch(() => log('fix it still working after 150 s'));
  mark(`fix answered (fixed=${await page.evaluate(() => document.documentElement.dataset.fixed)})`);
  await page.evaluate(() => document.querySelector('#helper')?.scrollIntoView({ block: 'center' })); await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}.1-proposal.png` });
  if (await page.locator('#applypreview').count()) {
    await page.evaluate(() => document.querySelector('#applypreview')?.click()); mark('fix applied');
    await page.waitForTimeout(2500); await page.click('#fitview').catch(() => {}); await page.waitForTimeout(2000);
    await page.screenshot({ path: `${out}.2-applied.png` });
  }
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
