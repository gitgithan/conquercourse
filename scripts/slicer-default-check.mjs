// CC-90: a ready place opens in the World Slicer already on its proved line and height ("Can clear" at once, no spinner),
// "Snap to the best line" brings it back after a tweak, and the World Editor gets the same line and height and agrees.
// PLACES=a,b,c  SHOTS=a,b,c (places to screenshot)  OUT=dir. Desktop 1280 px only. The map server is not needed (no Overpass call for a ready place).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const port = process.env.PORT ?? '5192', out = process.env.OUT ?? 'data/eval/cc-90-slicer-default'; mkdirSync(out, { recursive: true });
const places = (process.env.PLACES ?? 'shibuya-tokyo').split(','), shots = new Set((process.env.SHOTS ?? '').split(',').filter(Boolean));
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const results = {};
try {
  await new Promise((r) => setTimeout(r, 4000));
  const browser = await chromium.launch({ args: flags });
  for (const slug of places) {
    const place = JSON.parse(readFileSync(`public/assets/places/${slug}.json`, 'utf8')), c = (results[slug] = {});
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }), page = await ctx.newPage();
    page.on('pageerror', (e) => (c.pageerror = e.message.slice(0, 160)));
    await page.route(/overpass|maps\.mail\.ru/, (r) => r.abort());
    await page.route('**/api/photos**', (r) => r.fulfill({ status: 503, body: '{}' })); // no token here: the panel must say so politely
    try {
      await page.goto(`http://localhost:${port}/?mode=map&lat=${place.lat}&lon=${place.lon}&z=16`);
      await page.waitForSelector('#map canvas.maplibregl-canvas', { timeout: 60000 });
      await page.waitForFunction(() => document.documentElement.dataset.mapready === 'true', null, { timeout: 90000 }).catch(() => {});
      const box = await (await page.$('#map canvas.maplibregl-canvas')).boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.click('#build');
      await page.waitForSelector('#slice:not([disabled])', { timeout: 90000 });
      await page.evaluate(() => { window.__seq = []; const el = document.documentElement; const rec = () => { const v = el.dataset.sliceLane + '|' + (document.getElementById('cut')?.value ?? ''); if (window.__seq.at(-1)?.[1] !== v) window.__seq.push([Math.round(performance.now()), v]); }; new MutationObserver(rec).observe(el, { attributes: true }); });
      const t0 = Date.now(); await page.click('#slice');
      await page.waitForFunction(() => document.documentElement.dataset.sliceLane, null, { timeout: 60000 });
      await page.waitForFunction(() => document.documentElement.dataset.sliceLane && document.documentElement.dataset.sliceLane !== 'working', null, { timeout: 8000 }).catch(() => {});
      const first = await page.evaluate(() => ({ lane: document.documentElement.dataset.sliceLane, proven: document.documentElement.dataset.sliceLaneProven, def: document.documentElement.dataset.sliceDefault, says: document.querySelector('.simsays')?.textContent ?? '' }));
      c.firstLaneState = first.lane; c.openedClearAtOnce = first.lane === 'clearable' && first.proven === '1'; c.defaultKind = first.def; c.says = first.says.slice(0, 120); c.msToFirst = Date.now() - t0;
      c.sequence = await page.evaluate(() => window.__seq);
      c.noSpinner = !c.sequence.some(([, v]) => v.startsWith('working')) && !/checking|looking/i.test(first.says);
      await page.waitForTimeout(2500); // the silent re-check must not change the answer
      c.stillClearAfterQuietCheck = (await page.evaluate(() => document.documentElement.dataset.sliceLane)) === 'clearable' && (await page.evaluate(() => document.documentElement.dataset.sliceVerified)) !== 'disagrees';
      c.verified = await page.evaluate(() => document.documentElement.dataset.sliceVerified ?? '');
      c.streetPanel = await page.evaluate(() => document.getElementById('streetline')?.textContent ?? '');
      if (shots.has(slug)) await page.screenshot({ path: `${out}/${slug}-opens-clear.png` });
      // tweak the height, then snap back
      const cut0 = await page.inputValue('#cut'); await page.evaluate((v) => { const e = document.getElementById('cut'); e.value = String(Math.max(0, Number(e.max) > Number(v) + 3 ? Number(v) + 3 : Number(v) - 3)); e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change')); }, cut0);
      await page.waitForFunction(() => !document.querySelector('#snapbest')?.hidden, null, { timeout: 10000 }).then(() => (c.snapShownAfterTweak = true)).catch(() => (c.snapShownAfterTweak = false));
      if (c.snapShownAfterTweak) { await page.click('#snapbest'); await page.waitForFunction((v) => Number(document.getElementById('cut').value) === Number(v) && document.documentElement.dataset.lineMode === 'best', cut0, { timeout: 10000 }).then(() => (c.snapRestores = true)).catch(() => (c.snapRestores = false)); }
      // hand-off to the editor
      await page.waitForFunction(() => document.documentElement.dataset.sliceLane === 'clearable', null, { timeout: 20000 }).catch(() => {});
      await page.click('#buildpieces');
      await page.waitForFunction(() => new URLSearchParams(location.search).get('mode') === 'editor', null, { timeout: 60000 });
      await page.waitForFunction(() => document.documentElement.dataset.lane, null, { timeout: 90000 });
      const lane = JSON.parse(await page.evaluate(() => document.documentElement.dataset.lane));
      c.editorLane = lane; c.editorFrom = await page.evaluate(() => document.documentElement.dataset.laneFrom);
      await page.waitForFunction(() => /simulator can clear|cannot find|could not finish/.test(document.documentElement.dataset.verdict ?? ''), null, { timeout: 500000 });
      c.editorVerdict = await page.evaluate(() => document.documentElement.dataset.verdict); c.editorClears = /simulator can clear/.test(c.editorVerdict);
    } catch (e) { c.threw = String(e).slice(0, 200); }
    await ctx.close();
  }
  await browser.close();
} catch (e) { results.threw = String(e).slice(0, 200); }
server.kill();
writeFileSync(`${out}/run.json`, JSON.stringify({ checkedAt: new Date().toISOString().slice(0, 10), results }, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));
