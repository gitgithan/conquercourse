// CC-247: the one-screen Community flow in a browser, against a stubbed API (no paid job runs).
// Explore first, then Make your own: Photo -> Mark -> Segment Region(s) -> Choose -> Generate Piece / Save wallpaper -> What next, then the three tabs and the old screens at ?flow=0.
// Usage: PORT=5199 node scripts/community-flow-check.mjs test-results/community-flow   (pictures are small JPEGs; copy the ones worth keeping to docs/evidence)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5302', out = process.argv[2] ?? 'test-results/community-flow';
mkdirSync(out, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const checks = {};
const shot = (page, name) => page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 55 });
try {
  await new Promise((r) => setTimeout(r, 6000));
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  let segCalls = 0, liftCalls = 0, W = 1000, H = 700;
  await page.route('**/api/segment', (route) => {
    const b = route.request().postDataJSON();
    if (b.action === 'submit') segCalls++;
    route.fulfill({ json: b.action === 'submit' ? { id: 'fc-ABCDEFGHIJKL' } : { state: 'done', items: [{ label: 'bench', score: 0.9, box: [0.12 * W, 0.3 * H, 0.28 * W, 0.5 * H], cutout: png }, { label: 'wall', score: 0.8, box: [0.58 * W, 0.35 * H, 0.78 * W, 0.65 * H], cutout: png }, { label: 'stairs', score: 0.7, box: [0.4 * W, 0.8 * H, 0.5 * W, 0.9 * H], cutout: png }] } });
  });
  await page.route('**/api/object-lift', (route) => {
    const b = route.request().postDataJSON();
    if (b.action === 'submit') liftCalls++;
    route.fulfill({ json: b.action === 'submit' ? { id: 'fc-LIFTLIFTLIFT' } : { state: 'done', glb: 'Z2xURg==', mesh: { height_m: 0.9 }, privacy: {} } });
  });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://localhost:${port}/?mode=communities&flow=1&welcome=0`, { timeout: 120000, waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', null, { timeout: 90000 });
  checks.navMarked = await page.$eval('#sitenav [data-feature=community]', (e) => e.getAttribute('aria-current') === 'page');
  checks.tabs = (await page.$$eval('.com .tabs button', (b) => b.map((x) => x.textContent))).join() === 'Explore,Make your own';
  // Explore comes first: premade courses, then the Make your own button, then pieces and wallpapers
  await page.waitForSelector('#ex-courses .gal', { timeout: 60000 }); await page.waitForTimeout(1200);
  checks.exploreFirst = (await page.getAttribute('.com', 'data-tab')) === 'explore' && (await page.$('#cfile')) === null;
  checks.premadeCourses = (await page.$$('#ex-courses .gal button')).length >= 1;
  const order = await page.$$eval('.com > div > .panel', (n) => n.map((x) => x.id));
  checks.orderCoursesButtonObjects = order.join() === 'ex-courses,ex-make,ex-objects';
  await page.waitForSelector('#objgrid .card img', { timeout: 20000 });
  checks.premadeExamples = (await page.$$('#objgrid .card')).length >= 5;
  await shot(page, '0-explore');
  await page.click('#make-own'); await page.waitForSelector('#cfile');
  checks.enteredFlow = (await page.getAttribute('.com', 'data-tab')) === 'make';
  checks.laterStepsLocked = await page.$eval('#step-mark', (e) => e.disabled);
  await shot(page, '1-photo');
  // step 1: a sample photo
  await page.click('img[data-sample=park01]'); await page.waitForSelector('.stage img', { timeout: 20000 }); await page.waitForTimeout(500);
  checks.onMark = (await page.getAttribute('.panel', 'data-step')) === 'mark';
  checks.segmentLocked = await page.$eval('#cnext', (e) => e.disabled);
  // step 2: a click drops a box, a drag draws one
  const r = await page.$eval('.stage img', (e) => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
  await page.mouse.click(r.x + r.w * 0.2, r.y + r.h * 0.4);
  await page.mouse.move(r.x + r.w * 0.55, r.y + r.h * 0.3); await page.mouse.down(); await page.mouse.move(r.x + r.w * 0.8, r.y + r.h * 0.7, { steps: 6 }); await page.mouse.up();
  checks.twoMarks = (await page.$eval('.stage', (e) => Number(e.dataset.count))) === 2;
  checks.segmentOpen = !(await page.$eval('#cnext', (e) => e.disabled));
  await shot(page, '2-mark');
  await page.click('#cnext'); await page.waitForSelector('#cseg');
  checks.chooseLockedBeforeSegment = await page.$eval('#step-choose', (e) => e.disabled);
  await shot(page, '3-segment-before');
  // step 3: Segment Region(s)
  [W, H] = await page.$eval('.stage img', (e) => [e.naturalWidth, e.naturalHeight]); // the stub places its outlines on the real photo size
  await page.click('#cseg'); await page.waitForFunction(() => !document.querySelector('#cnext').disabled, null, { timeout: 30000 });
  checks.segmentedOnce = segCalls === 1;
  checks.chips = (await page.$$('#chips .chip')).length === 2;
  checks.cutouts = (await page.$$('.stage .box.cut')).length >= 1;
  await shot(page, '4-segment-after');
  // step 4: first area a 3D piece, second a wallpaper
  await page.click('#cnext'); await page.waitForSelector('.item');
  checks.makeLocked = await page.$eval('#cnext', (e) => e.disabled);
  const ids = await page.$$eval('.item', (n) => n.map((x) => x.dataset.id));
  await page.fill(`#cname-${ids[0]}`, 'bench');
  await page.click(`#choose-piece-${ids[0]}`); await page.click(`#choose-wall-${ids[1]}`);
  checks.makeOpen = !(await page.$eval('#cnext', (e) => e.disabled));
  await shot(page, '5-choose');
  await page.click('#cnext'); await page.waitForSelector(`#gen-${ids[0]}`);
  await shot(page, '6-make');
  // step 5: Generate Piece, then save the wallpaper on a course
  await page.click(`#gen-${ids[0]}`); await page.waitForFunction((id) => /Done/.test(document.querySelector(`#cmsg-${id}`)?.textContent ?? ''), ids[0], { timeout: 60000 });
  checks.generated = liftCalls === 1;
  await page.click(`#wsave-${ids[1]}`); await page.waitForFunction((id) => /Saved/.test(document.querySelector(`#cmsg-${id}`)?.textContent ?? ''), ids[1], { timeout: 10000 });
  checks.whatNext = (await page.$('#go-editor')) !== null && (await page.$('#go-course')) !== null;
  checks.courseLink = /wallpaper=w/.test((await page.getAttribute('#go-course', 'href')) ?? '');
  await shot(page, '7-what-next');
  // the piece is in the editor tray
  checks.pieceKept = await page.evaluate(async () => { const db = await new Promise((ok, no) => { const q = indexedDB.open('cc-user-objects', 1); q.onsuccess = () => ok(q.result); q.onerror = no; }); return await new Promise((ok) => { const q = db.transaction('objects').objectStore('objects').count(); q.onsuccess = () => ok(q.result >= 1); }); });
  // tabs
  await page.click('#go-objects'); await page.waitForTimeout(1500);
  checks.yoursShown = (await page.$$eval('#objgrid .card strong', (n) => n.filter((x) => /^Yours:/.test(x.textContent)).length)) >= 2;
  await shot(page, '8-explore-yours');
  await page.click('#tab-make'); checks.workKept = (await page.getAttribute('.panel', 'data-step')) === 'make';
  // old gallery address opens Places; ?flow=0 keeps the old screens
  await page.goto(`http://localhost:${port}/?mode=gallery&flow=1&welcome=0`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.com[data-tab=explore]', { timeout: 60000 });
  checks.galleryIsExplore = true;
  await page.goto(`http://localhost:${port}/?mode=communities&flow=0&welcome=0`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#tab-browse', { timeout: 60000 });
  checks.oldScreens = true;
  console.log(checks, 'errors:', errors);
  const bad = Object.entries(checks).filter(([, v]) => v !== true).map(([k]) => k);
  if (bad.length || errors.length) { console.log('FAILED', bad); process.exitCode = 1; }
  await browser.close();
} finally { server.kill(); }
