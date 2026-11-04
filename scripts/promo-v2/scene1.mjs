// Promo storyboard scene 1 (CC-133): clip a = "Drop a pin anywhere", b = "Slice this place", c = "Cut a height" then "Send to the World Editor".
// usage: node scene1.mjs <a|b|c> <playwright> <outdir> [baseUrl]      env PHOTO_API=<site> forwards GET /api/photos (Mapillary, shown live, nothing stored) when the dev server has no key
// Stepped clock and the yellow click circle come from lib.mjs. The pin goes on the exact spot of the prepared Shibuya course: lat/lon of public/assets/places/shibuya-tokyo.json.
import { readFileSync, writeFileSync } from 'node:fs';
import { openSession, retime, ease } from './lib.mjs';
const [which, pw, out, base = 'http://localhost:5173'] = process.argv.slice(2);
const P = JSON.parse(readFileSync(new URL('./params/scene1.json', import.meta.url), 'utf8'));
const A = P[which], place = JSON.parse(readFileSync(new URL('../../' + P.placeFile, import.meta.url), 'utf8'));
const S = await openSession({ url: null, out, pw }); const p = S.p;
p.on('console', (m) => { if (/Slice|slice/.test(m.text())) console.log('console', m.text().slice(0, 100)); });
if (process.env.PHOTO_API) await p.route('**/api/photos**', async (r) => { try { const u = new URL(r.request().url()); const res = await fetch(process.env.PHOTO_API + u.pathname + u.search); r.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() }); } catch { r.fulfill({ status: 503, body: '{}' }); } });
await p.addInitScript(() => { try { localStorage.setItem('cc.next.seen', '1'); } catch { /* ok */ } });
const url = base + P.url + (which === 'a' ? '' : `&lat=${place.lat}&lon=${place.lon}&z=${A.zoom}`);
await p.goto(url);
await p.waitForFunction(() => document.documentElement.dataset.mapready === 'true' && window.__ccMap, null, { timeout: 180000 }).catch(() => console.log('map not ready'));
await S.settle(1500); await S.hideChrome();
const mapReady = (ms = 60000) => S.until(() => window.__ccMap.map.areTilesLoaded(), 'tiles', ms);
const proj = () => p.evaluate(([lat, lon]) => { const m = window.__ccMap.map, r = m.getCanvas().getBoundingClientRect(), q = m.project([lon, lat]); return { x: r.left + q.x, y: r.top + q.y }; }, [place.lat, place.lon]);
const pinAt = async () => { const q = await proj(); await S.pressAt(q.x, q.y, { move: 0.8, hold: 0.3, after: 0.1 }); return q; };

async function clipA() {
  await p.evaluate(() => window.__ccMap.map.setProjection({ type: 'globe' }));
  const lonD = ((place.lon - A.startCenter[0] + 540) % 360) - 180, cam = (u) => p.evaluate(([c0, lonD, lat, lon, z0, z1, u]) => { const m = window.__ccMap.map, e = u * u * (3 - 2 * u), z = z0 + (z1 - z0) * Math.pow(e, 0.85); m.jumpTo({ center: [c0[0] + lonD * e, c0[1] + (lat - c0[1]) * e], zoom: z, pitch: 0, bearing: 0 }); }, [A.startCenter, lonD, place.lat, place.lon, A.startZoom, A.endZoom, u]);
  // silent warm-up of the tiles along the whole path (real waits, no pictures)
  for (let u = 0; u <= 1.0001; u += 0.04) { await cam(u); await mapReady(30000); await S.settle(250); }
  await cam(0); await mapReady(); await S.settle(800);
  await S.rec(0.35);                                        // the globe, already turning slowly
  S.mark('zoomStart');
  await S.rec(A.zoomSecs, async (u) => { await cam(u); await mapReady(20000); });
  S.mark('zoomEnd');
  await S.settle(1500); await mapReady();
  const q = await pinAt(); S.mark('pin');
  console.log('pin data', await p.evaluate(() => document.documentElement.dataset.pin), 'place', place.lat, place.lon);
  await S.rec(0.5);
  // wait for the photo dots, then click the dot nearest to the pin
  await S.until(() => (document.querySelector('#map')?.dataset.photodots ?? '0') !== '0', 'dots', 60000);
  await S.settle(1200);
  const dots = await p.evaluate(() => { const m = window.__ccMap.map, seen = new Set(), c = m.getCanvas().getBoundingClientRect(); return m.querySourceFeatures('pd-dot').filter((f) => !seen.has(f.properties.id) && seen.add(f.properties.id)).map((f) => { const q = m.project(f.geometry.coordinates); return { x: c.left + q.x, y: c.top + q.y }; }); });
  const pick = dots.filter((d) => d.x > 360 && d.x < 1180 && d.y > 150 && d.y < 600).sort((a, b) => Math.hypot(a.x - q.x, a.y - q.y) - Math.hypot(b.x - q.x, b.y - q.y))[Number(process.env.DOT_INDEX ?? 0)];
  console.log('dots', dots.length, 'pick', JSON.stringify(pick));
  if (!pick) throw new Error('no photo dot');
  await S.glide(pick.x, pick.y, A.glideSecs);
  await p.mouse.down(); await S.rec(0.3); await p.mouse.up(); S.mark('photoClick');
  await S.until(() => { const i = document.querySelector('#photodotpanel img'); return !!i && i.complete && i.naturalWidth > 0; }, 'photo', 60000, false);
  await S.rec(A.photoHold); S.mark('end');
  return { pin: await p.evaluate(() => document.documentElement.dataset.pin) };
}

async function sliceFirst(recordFlight) {
  const q = await pinAt();
  await S.until(() => !document.querySelector('#slice').disabled, 'slice enabled', 120000);
  await S.rec(0.3);
  await S.clickSel('#slice', { move: 0.6, hold: 0.3, after: 0 }); S.mark('sliceClick');
  await S.until(() => document.documentElement.dataset.flightDone === '1', 'flight', 600000, recordFlight);
  await S.until(() => document.documentElement.dataset.sliceLane && document.documentElement.dataset.sliceLane !== 'working', 'lane', 300000, recordFlight);
  S.mark('flightDone');
  return q;
}

async function clipB() {
  await sliceFirst(true);
  await S.rec(0.4);
  S.mark('end');
}

async function clipC() {
  // the slice itself is not part of this clip: it runs first without pictures, then the film starts with the slice done
  await sliceFirst(false);
  await S.settle(1500);
  S.n = 0; S.marks = {}; await S.rec(0.3); S.mark('start');
  const def = await p.evaluate(() => Number(document.querySelector('#cut').value));
  await p.evaluate(() => document.querySelector('#cut').scrollIntoView({ block: 'center' })); await S.rec(0.2);
  await S.glideTo('#cut', 0.5);
  await S.slide('#cut', A.cutUp, A.slideSecs); S.mark('cutUp');
  await S.slide('#cut', A.cutDown, A.slideSecs); S.mark('cutDown');
  await S.slide('#cut', def, A.slideSecs * 0.6); S.mark('cutDefault');
  console.log('default cut', def, 'now', await p.evaluate(() => document.querySelector('#cut').value));
  await p.evaluate(() => { let e = document.querySelector('#buildpieces'); while (e && e.scrollHeight <= e.clientHeight + 10) e = e.parentElement; e?.setAttribute('data-promo-scroll', '1'); });
  const top = await p.evaluate(() => document.querySelector('[data-promo-scroll]')?.scrollTop ?? 0);
  await S.scrollTo('[data-promo-scroll]', top + 1500, A.scrollSecs); S.mark('scrolled');
  await S.clickSel('#buildpieces', { move: 0.7, hold: 0.3, after: 0 }); S.mark('send');
  await S.until(() => /mode=editor/.test(location.search) && document.documentElement.dataset.ready === 'true', 'editor', 240000, false);
  await S.settle(2500); await S.hideChrome();
  if (await p.isVisible('#glossaryhide')) await p.click('#glossaryhide');
  if (await p.isVisible('#helper')) await p.click('#closehelper');
  await S.settle(500);
  S.mark('editorOpen');
  await S.rec(0.5);
  await S.clickSel('#fitview', { move: 0.7, hold: 0.3, after: 0.3 }); S.mark('fit');   // the editor opens with the world cropped: Fit puts all of it in view
  await S.rec(A.editorHold); S.mark('end');
}

let extra = {};
if (which === 'a') extra = await clipA(); else if (which === 'b') await clipB(); else await clipC();
await S.finish({ params: A, place: { name: place.name, lat: place.lat, lon: place.lon, source: P.placeFile }, ...extra });
// retime so the final clip is about targetSecs long (never slower than real time)
const secs = S.n / S.fps, k = Math.max(1, +(secs / A.targetSecs).toFixed(3));
retime(out, `${out}/clip.mp4`, { k });
writeFileSync(`${out}/retime.json`, JSON.stringify({ gameSeconds: +secs.toFixed(2), speedUp: k, finalSeconds: +(secs / k).toFixed(2) }, null, 2));
console.log('done', secs.toFixed(1), 's game ->', (secs / k).toFixed(1), 's final, k', k);
