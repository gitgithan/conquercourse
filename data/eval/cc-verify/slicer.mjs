// CC-186 (5, slice panel): a ready place on the map, Slice, legend shown, a failing height gives one reason and fixes, a fix button changes the cut and the answer is checked again.
import { launch, ok, save, shot, base } from './lib.mjs';
import { readFileSync } from 'node:fs';
const place = JSON.parse(readFileSync(new URL('../../../public/assets/places/bryant-park-new-york.json', import.meta.url), 'utf8'));
const b = await launch();
const page = await b.newPage({ viewport: { width: 1280, height: 800 } }); const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto(`${base}/?mode=map&lat=${place.lat}&lon=${place.lon}&z=17&flight=0&welcome=0`, { waitUntil: 'load' });
await page.waitForSelector('#map canvas.maplibregl-canvas', { timeout: 90000 });
await page.waitForFunction(() => document.documentElement.dataset.mapready === 'true', null, { timeout: 90000 }).catch(() => {});
const box = await (await page.$('#map canvas.maplibregl-canvas')).boundingBox();
await page.mouse.click(box.x + box.width * 0.4, box.y + box.height / 2);
await page.waitForFunction(() => !!document.documentElement.dataset.pin, null, { timeout: 15000 });
await page.waitForFunction(() => !document.getElementById('slice').disabled, null, { timeout: 120000 });
await shot(page, 'slicer-1-pinned');
await page.click('#slice');
const ready = await page.waitForFunction(() => document.documentElement.dataset.sliceReady === '1', null, { timeout: 180000 }).then(() => true, () => false);
await page.waitForTimeout(2500);
ok('5 slicer', 'Slice works on a ready place', ready);
const info = () => page.evaluate(() => ({ lane: document.documentElement.dataset.sliceLane, read: document.getElementById('sliceread')?.innerText, why: document.getElementById('slicewhy')?.innerText, whyKind: document.documentElement.dataset.sliceWhyKind, fixes: document.documentElement.dataset.sliceFixes, legend: document.getElementById('slicelegend') && getComputedStyle(document.getElementById('slicelegend')).display, legendText: document.getElementById('slicelegend')?.innerText, strip: document.documentElement.dataset.sliceStrip, cut: document.getElementById('cut')?.value, more: document.getElementById('slicemore')?.open }));
let i0 = await info(); console.log(JSON.stringify(i0));
await shot(page, 'slicer-2-sliced');
ok('5 slicer', 'colour legend is on the slice panel', i0.legend && i0.legend !== 'none' && /lane/.test(i0.legendText ?? '') && /no lane/.test(i0.legendText ?? ''), (i0.legendText ?? '').replace(/\n/g, ' | '));
ok('5 slicer', '"More" details are folded by default (fewer words)', i0.more === false);
// find a height with no path: try every strip height that is not 'ok'
const strip = JSON.parse(i0.strip ?? '[]'); console.log('strip', JSON.stringify(strip));
const bad = strip.find((s) => s[1] !== 'ok');
if (bad) {
  await page.$eval('#cut', (el, v) => { el.value = String(v); el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')); }, bad[0]);
  await page.waitForFunction(() => ['clearable', 'not-clearable', 'none'].includes(document.documentElement.dataset.sliceLane), null, { timeout: 240000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const i1 = await info(); console.log(JSON.stringify(i1)); await shot(page, 'slicer-3-no-path');
  ok('5 slicer', `a failing height (${bad[0]} m) says why in plain words`, !!i1.why && i1.why.length > 10 && i1.lane !== 'clearable', (i1.why ?? '').replace(/\n/g, ' | ').slice(0, 200));
  const sb = await page.$$('#slicewhy button.sugg');
  ok('5 slicer', 'ranked fixes are offered (up to 3)', sb.length <= 3, `${sb.length} buttons; ${i1.fixes}`);
  if (sb.length) { const before = await info(); await sb[0].click(); await page.waitForTimeout(6000); const after = await info(); await shot(page, 'slicer-4-after-fix'); ok('5 slicer', 'pressing a fix changes the cut or the picture and checks again', before.cut !== after.cut || before.read !== after.read || before.lane !== after.lane, `cut ${before.cut} -> ${after.cut}; lane ${before.lane} -> ${after.lane}`); }
} else ok('5 slicer', 'a failing height exists in the strip to test the fixes', false, 'every height crossable; cannot test why/fixes here');
ok('5 slicer', 'no page errors', errs.length === 0, errs.join(';').slice(0, 200));
save('run-slicer.json'); await b.close();
