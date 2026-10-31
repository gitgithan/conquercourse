// Parts gallery, before and after: one card of the real gallery page, with the Banana saved as the player's own choice.
// BEFORE re-creates the old frame address (no char, no nosave); AFTER is the page as it ships.
// usage: node data/eval/cc-chars-facing/scripts/gallery-girl.mjs OUT_DIR [PART_ID]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const [OUT, PART = 'run'] = process.argv.slice(2);
const BANANA = '7c95df17d131f152';
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', '5197', '--strictPort'], { stdio: 'ignore' });
mkdirSync(OUT, { recursive: true });
const report = {};
try {
  await new Promise((r) => setTimeout(r, 6000));
  const browser = await chromium.launch({ args: flags });
  for (const mode of ['before', 'after']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
    await ctx.addInitScript((id) => { try { localStorage.setItem('cc.character', id); } catch {} }, BANANA);
    const page = await ctx.newPage();
    if (mode === 'before') await page.route(/\/\?course=/, (route) => { const u = new URL(route.request().url()); u.searchParams.delete('char'); u.searchParams.delete('nosave'); route.fulfill({ status: 302, headers: { location: u.toString() } }); });
    await page.goto('http://localhost:5197/?mode=parts&welcome=0');
    await page.waitForSelector('article[data-part]');
    const card = page.locator(`article[data-part="${PART}"]:visible`).first();
    await card.scrollIntoViewIfNeeded();
    await card.locator('.pg-view').click();
    await page.waitForSelector(`iframe[data-part="${PART}"]`);
    const start = Date.now();
    while (Date.now() - start < 120000) { const t = await page.evaluate((id) => Number(document.querySelector(`iframe[data-part="${id}"]`)?.contentDocument?.documentElement.dataset.tick ?? -1), PART); if (t >= 120) break; await page.waitForTimeout(500); }
    await page.waitForTimeout(1500);
    await card.screenshot({ path: `${OUT}/${mode}.png` });
    report[mode] = { loaded: await page.evaluate((id) => document.querySelector(`iframe[data-part="${id}"]`)?.contentWindow?.location.search, PART), frame: await page.evaluate((id) => document.querySelector(`iframe[data-part="${id}"]`)?.getAttribute('src'), PART), savedChoice: await page.evaluate(() => localStorage.getItem('cc.character')) };
    await ctx.close();
  }
  await browser.close();
} finally { server.kill(); writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2)); }
