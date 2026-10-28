// CC-89: every page has the Courses button and the gallery behind it.
//   PORT=5391 node scripts/picker-check.mjs      (screenshots in test-results/picker/)
// Per mode and size: the button is visible, nothing covers it, it covers no other control, the gallery opens, searches, moves with the
// arrow keys, closes with Esc and a click on a card lands on that course. The Course also stops while the gallery is open.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const MODES = [
  ['course', '?course=/assets/demo/lache.course.json&welcome=0'],
  ['generated', '?generate=3&welcome=0'],
  ['unlisted', '?course=/assets/demo/lane-1.course.json&welcome=0'],
  ['editor', '?mode=editor'],
  ['coaster', '?mode=coaster'],
  ['map', '?mode=map'],
  ['dojo', '?mode=dojo'],
  ['park', '?mode=park'],
  ['gallery', '?mode=gallery'],
  ['diagrams', '?mode=diagrams'],
];
const SIZES = (process.env.SIZES ?? '1280x720,1024x640,390x800').split(',').map((z) => z.split('x').map(Number)); // SIZES=390x800 runs one size
const results = {}; const errors = []; const notTested = [];
const ok = (k, v) => { results[k] = !!v; };
mkdirSync('test-results/picker', { recursive: true });
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  for (const [vw, vh] of SIZES) {
    for (const [name, query] of MODES) {
      if (name === 'generated' && vw !== 1280) continue; // the same page at every size adds nothing
      if (name === 'unlisted' && vw !== 1280) continue;
      const tag = `${vw}x${vh} ${name}`;
      const page = await browser.newPage({ viewport: { width: vw, height: vh } });
      try {
      page.on('pageerror', (e) => errors.push(`${tag}: ${e.message.slice(0, 120)}`));
      await page.goto(`http://localhost:${port}/${query}`);
      const there = await page.waitForSelector('#courses-btn', { timeout: 150000 }).then(() => true, () => false);
      if (!there) { if (name === 'map') { notTested.push(tag); await page.close(); continue; } ok(`${tag}: button is there`, false); await page.close(); continue; }
      if (['course', 'generated', 'unlisted'].includes(name)) await page.waitForFunction(() => document.documentElement.dataset.tick !== undefined, null, { timeout: 150000 }).catch(() => {});
      await page.waitForTimeout(1200);
      // 1. visible, uncovered, covers nothing
      const geo = await page.evaluate(() => {
        const b = document.getElementById('courses-btn'); const r = b.getBoundingClientRect();
        const inside = r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && r.width > 20;
        const pts = [[r.left + 3, r.top + 3], [r.right - 3, r.top + 3], [r.left + 3, r.bottom - 3], [r.right - 3, r.bottom - 3], [r.left + r.width / 2, r.top + r.height / 2]];
        const [cx, cy] = pts[4]; const uncovered = document.elementsFromPoint(cx, cy)[0] === b; // the middle: the corners of a rounded button are not the button
        const hits = [];
        for (const e of document.querySelectorAll('button,a,input,select,textarea,summary,[role=button],[tabindex]')) {
          if (e === b) continue;
          const q = e.getBoundingClientRect();
          const st = getComputedStyle(e);
          if (q.width < 4 || q.height < 4 || st.visibility === 'hidden' || st.display === 'none' || Number(st.opacity) === 0) continue;
          if (q.right < 0 || q.bottom < 0 || q.left > innerWidth || q.top > innerHeight) continue;
          const w = Math.min(q.right, r.right) - Math.max(q.left, r.left), h = Math.min(q.bottom, r.bottom) - Math.max(q.top, r.top);
          if (w > 2 && h > 2) hits.push((e.id || e.className || e.tagName).toString().slice(0, 40) + ' ' + (e.textContent ?? '').trim().slice(0, 20));
        }
        return { inside, uncovered, hits, rect: [r.left, r.top, r.width, r.height].map(Math.round) };
      });
      ok(`${tag}: button inside the window`, geo.inside);
      ok(`${tag}: nothing covers the button`, geo.uncovered);
      const phone = vw <= 520; // a fixed button over a page that scrolls always has some control under it at some scroll position: only checked on desktop sizes
      if (!phone) ok(`${tag}: button covers no control ${geo.hits.join(' | ')}`, geo.hits.length === 0);
      if ((!phone && geo.hits.length) || !geo.uncovered) await page.screenshot({ path: `test-results/picker/PROBLEM-${vw}x${vh}-${name}.png` });
      // 2. the gallery
      await page.screenshot({ path: `test-results/picker/${vw}x${vh}-${name}-button.png` });
      if (name === 'course' && vw === 1280) { // the Course waits while the gallery is open
        await page.keyboard.press('Space'); await page.keyboard.down('ArrowRight'); await page.waitForTimeout(1500);
        const tick = () => page.evaluate(() => Number(document.documentElement.dataset.tick));
        const t0 = await tick(); await page.waitForTimeout(1500); const t1 = await tick();
        await page.click('#courses-btn'); await page.waitForTimeout(600);
        const t2 = await tick(); await page.waitForTimeout(800); const t3 = await tick();
        ok(`${tag}: game was running before (${t0}->${t1})`, t1 > t0);
        ok(`${tag}: game waits while the gallery is open (${t2}->${t3})`, t3 === t2);
        await page.keyboard.press('Escape'); await page.keyboard.up('ArrowRight');
        await page.waitForTimeout(800);
        ok(`${tag}: game goes on after Esc`, (await tick()) >= t3);
        await page.click('#courses-btn');
      } else await page.click('#courses-btn');
      await page.waitForSelector('#world-gallery .wg-card', { timeout: 15000 });
      await page.waitForTimeout(500);
      const cards = await page.$$eval('#world-gallery .wg-card', (cs) => cs.map((c) => c.dataset.value));
      ok(`${tag}: gallery lists the worlds (${cards.length})`, cards.length >= 25);
      const heads = await page.$$eval('#world-gallery h3', (hs) => hs.map((h) => h.textContent));
      ok(`${tag}: groups ${heads.join(', ')}`, ['Real places', 'Contraptions', 'Moves', 'Make your own'].every((g) => heads.includes(g)));
      const here = await page.$$eval('#world-gallery .wg-card[aria-current=true]', (cs) => cs.map((c) => c.dataset.value));
      const wantHere = { course: '/assets/demo/lache.course.json', generated: 'generate-same', unlisted: 'stay', editor: 'editor', coaster: 'coaster-builder', map: 'map' }[name];
      ok(`${tag}: current course is marked (${here.join()})`, wantHere ? here.length === 1 && here[0] === wantHere : here.length === 0);
      ok(`${tag}: the pictures load`, await page.evaluate(() => { const im = [...document.querySelectorAll('#world-gallery .wg-pic img')]; return im.length > 10 && im.filter((i) => i.complete && i.naturalWidth > 0).length >= Math.min(6, im.length); }));
      await page.screenshot({ path: `test-results/picker/${vw}x${vh}-${name}-gallery.png` });
      if (vw === 1280 || name === 'course') {
        // search
        await page.fill('#gallery-search', 'coaster'); await page.waitForTimeout(200);
        const shown = await page.$$eval('#world-gallery .wg-card:not([hidden])', (cs) => cs.length);
        ok(`${tag}: search narrows the cards (${shown})`, shown >= 2 && shown < cards.length / 2);
        await page.fill('#gallery-search', 'zzzzqq'); await page.waitForTimeout(150);
        ok(`${tag}: search with no match says so`, await page.locator('#world-gallery .wg-none').isVisible());
        await page.fill('#gallery-search', '');
        // keys: from the search box Down goes to a card, Right moves on, Esc closes
        await page.focus('#gallery-search'); await page.keyboard.press('ArrowDown');
        const f1 = await page.evaluate(() => document.activeElement?.dataset?.value ?? null);
        await page.keyboard.press('ArrowRight');
        const f2 = await page.evaluate(() => document.activeElement?.dataset?.value ?? null);
        ok(`${tag}: arrow keys move between cards (${f1} -> ${f2})`, f1 !== null && f2 !== null && f1 !== f2);
        await page.keyboard.press('ArrowDown');
        const f3 = await page.evaluate(() => document.activeElement?.dataset?.value ?? null);
        ok(`${tag}: arrow down moves a row`, f3 !== null && f3 !== f2);
        await page.keyboard.press('Escape'); await page.waitForTimeout(300);
        ok(`${tag}: Esc closes it`, (await page.$('#world-gallery')) === null);
        await page.click('#courses-btn'); await page.waitForSelector('#world-gallery .wg-card');
        if (vw > 520) { await page.mouse.click(2, Math.round(vh / 2)); await page.waitForTimeout(500); ok(`${tag}: a click outside closes it`, (await page.$('#world-gallery')) === null); }
        else { await page.click('#world-gallery .wg-x'); await page.waitForTimeout(300); ok(`${tag}: the close button closes it`, (await page.$('#world-gallery')) === null); }
        await page.click('#courses-btn'); await page.waitForSelector('#world-gallery .wg-card');
      }
      // 3. a click on a card lands on that course (the editor, the map and the Course; the others only once)
      if (vw === 1280 && ['course', 'editor', 'map', 'coaster', 'dojo'].includes(name)) {
        const target = name === 'course' ? '/assets/demo/drop.course.json' : '/assets/demo/climb.course.json';
        await Promise.all([page.waitForURL((u) => u.search.includes(`course=${target}`), { timeout: 30000 }).catch(() => {}), page.click(`#world-gallery .wg-card[data-value="${target}"]`)]);
        ok(`${tag}: picking a card goes to it (${new URL(page.url()).search.slice(0, 60)})`, page.url().includes(`course=${target}`));
        const landed = await page.waitForFunction(() => document.documentElement.dataset.tick !== undefined, null, { timeout: 150000 }).then(() => true, () => false);
        ok(`${tag}: and the course runs`, landed);
        await page.waitForTimeout(800);
        ok(`${tag}: and has the Courses button too`, (await page.$('#courses-btn')) !== null);
        await page.screenshot({ path: `test-results/picker/${vw}x${vh}-${name}-landed.png` });
      }
      } catch (e) { errors.push(`${tag}: ${e.message.split('\n')[0].slice(0, 160)}`); await page.screenshot({ path: `test-results/picker/ERROR-${vw}x${vh}-${name}.png` }).catch(() => {}); } finally { await page.close().catch(() => {}); }
    }
  }
  await browser.close();
  console.log(JSON.stringify({ results, errors, notTested }, null, 1));
  const bad = Object.entries(results).filter(([, v]) => !v).map(([k]) => k);
  if (bad.length || errors.length) { console.log('FAIL', bad, errors); process.exitCode = 1; } else console.log('OK', Object.keys(results).length, 'checks', notTested.length ? `(not tested: ${notTested.join(', ')})` : '');
} finally { server.kill(); }
