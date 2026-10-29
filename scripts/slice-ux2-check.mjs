// CC-201 to CC-207 in the browser at 1280 px: course list card, back button, gallery, proven heights on several places, ground line hidden, cut sentence, tilt, wheel.
// Needs vite deps; run on the VM: PORT=5294 node scripts/slice-ux2-check.mjs. Stills go to data/eval/slice-ux2/shots/.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const port = process.env.PORT ?? '5294', out = 'data/eval/slice-ux2', shots = `${out}/shots`;
const slugs = (process.env.SLUGS ?? 'montmartre-paris,eixample-barcelona,shibuya-tokyo,edinburgh-old-town').split(',');
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const checks = {}, notes = [], places = {};
const d = (page, k) => page.evaluate((kk) => document.documentElement.dataset[kk], k);
const settle = (page, ms = 280000) => page.waitForFunction(() => ['clearable', 'not-clearable', 'none'].includes(document.documentElement.dataset.sliceLane), null, { timeout: ms });
mkdirSync(shots, { recursive: true });
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => notes.push('PAGEERROR ' + e.message.slice(0, 200)));
  // ---- Q1: the Courses list has the card; the slicing screen has a way back
  await page.goto(`http://localhost:${port}/?mode=dojo&dojo=old`);
  await page.waitForSelector('#courses-btn', { timeout: 60000 });
  await page.evaluate(() => document.getElementById('courses-btn').click()); await page.waitForTimeout(1200);
  const card = page.getByText('Slice a real place').first();
  checks.courseListHasSliceCard = (await card.count()) > 0;
  await page.screenshot({ path: `${shots}/q1-courses.png` });
  if (checks.courseListHasSliceCard) { await card.click(); await page.waitForTimeout(1500); }
  checks.cardOpensSlicer = /mode=map/.test(page.url()) || (await page.$('#slice')) !== null;
  for (const slug of slugs) {
    const url = `http://localhost:${port}/?mode=map&hooks=1&flight=0&places=all`;
    await page.goto(url);
    await page.waitForSelector('#map canvas.maplibregl-canvas', { timeout: 60000 });
    await page.waitForFunction(() => document.documentElement.dataset.mapready === 'true', null, { timeout: 90000 }).catch(() => notes.push('map style slow'));
    await page.waitForSelector('#ready .card', { timeout: 30000 });
    if (slug === slugs[0]) {
      const n = await page.$$eval('#ready .card', (c) => c.length), photos = await page.$$eval('#ready .card img[data-kind=photo]', (c) => c.length);
      checks.galleryCards = n > 0; notes.push(`gallery: ${n} cards (${photos} with a photo); readyPlaces=${await d(page, 'readyPlaces')}`);
      checks.backButton = (await page.$('#backcourses')) !== null;
      await page.screenshot({ path: `${shots}/q8-gallery.png` });
    }
    await page.click(`button[data-slug="${slug}"]`);
    await page.waitForFunction(() => !!document.documentElement.dataset.pin, null, { timeout: 20000 });
    await page.click('#slice');
    await page.waitForFunction(() => document.documentElement.dataset.flightDone === '1', null, { timeout: 120000 });
    await settle(page);
    await page.waitForFunction(() => document.documentElement.dataset.sliceStripDone === '1', null, { timeout: 600000 });
    const strip = JSON.parse(await d(page, 'sliceStrip'));
    const greens = strip.filter(([, s]) => s === 'ok'), tried = [];
    for (const [h] of greens.slice(0, 4)) {
      await page.$eval('#cut', (el, x) => { el.value = String(x); el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')); }, h);
      await page.waitForTimeout(600); await settle(page);
      tried.push([h, await d(page, 'sliceLane')]);
    }
    places[slug] = { strip, greens: greens.length, clickedGreen: tried, allGreenGavePath: tried.every(([, s]) => s === 'clearable') };
    notes.push(`${slug}: strip ${JSON.stringify(strip)}; clicked greens ${JSON.stringify(tried)}`);
    if (slug === slugs[0]) {
      checks.groundLineHidden = (await page.evaluate(() => window.__ccMap.map.getLayoutProperty('sl-contour', 'visibility'))) === 'none';
      checks.cutSentence = /runner starts on the cut height/i.test(await page.textContent('#cutsay'));
      await page.screenshot({ path: `${shots}/q2-q5-q6-strip.png` });
      // ---- Q7: tilt to the ground, wheel and pan still work
      await page.$eval('#tilt', (el) => { el.value = '88'; el.dispatchEvent(new Event('input')); }); await page.waitForTimeout(600);
      const pitch = await page.evaluate(() => window.__ccMap.map.getPitch()); checks.tiltReaches85 = pitch >= 85; notes.push(`pitch ${pitch}`);
      await page.screenshot({ path: `${shots}/q7-tilt-88.png` });
      const z0 = await page.evaluate(() => window.__ccMap.map.getZoom());
      await page.mouse.move(500, 400); await page.mouse.wheel(0, -400); await page.waitForTimeout(800);
      checks.wheelZooms = (await page.evaluate(() => window.__ccMap.map.getZoom())) !== z0;
      const c0 = await page.evaluate(() => window.__ccMap.map.getCenter().lng);
      await page.mouse.move(300, 300); await page.mouse.down(); await page.mouse.move(380, 300, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(500);
      checks.panWorks = (await page.evaluate(() => window.__ccMap.map.getCenter().lng)) !== c0;
      await page.$eval('#tilt', (el) => { el.value = '60'; el.dispatchEvent(new Event('input')); });
    }
  }
  checks.everyClickedGreenGivesPath = Object.values(places).every((p) => p.allGreenGavePath);
  checks.placesTested = Object.keys(places).length;
  await browser.close();
} catch (e) { checks.threw = String(e).slice(0, 300); }
server.kill();
writeFileSync(`${out}/browser-check.json`, JSON.stringify({ checks, places, notes }, null, 2) + '\n');
console.log(JSON.stringify({ checks, notes }, null, 2));
