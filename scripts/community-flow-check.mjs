// CC-247: the one-screen Community flow in a browser, against a stubbed API (no paid job runs).
// Explore first, then Make your own: Photo -> Mark -> Segment Region -> Choose -> Generate Piece / Save wallpaper -> What next, with one rectangle at a time, a stepped progress bar from the job's stage names, and plain-words refusals with a clock time.
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
  let segCalls = 0, liftCalls = 0, segPolls = 0, liftPolls = 0, W = 1000, H = 700, segOff = false, refuse = null;
  const stub = (json, status = 200) => ({ json, status });
  await page.route('**/api/segment', (route) => {
    const b = route.request().postDataJSON();
    if (b.action === 'submit') { segCalls++; segPolls = 0; return route.fulfill(segOff ? stub({ error: 'off', message: 'off' }, 503) : stub({ id: 'fc-ABCDEFGHIJKL' })); }
    segPolls++;
    route.fulfill(segPolls < 3 ? stub({ state: 'running', stage: segPolls < 2 ? undefined : 'finding' }) : stub({ state: 'done', items: [{ label: 'bench', score: 0.9, box: [0.12 * W, 0.3 * H, 0.28 * W, 0.5 * H], cutout: png }, { label: 'wall', score: 0.8, box: [0.6 * W, 0.2 * H, 0.9 * W, 0.7 * H], cutout: png }], privacy: {}, seconds: 3 }));
  });
  await page.route('**/api/object-lift', (route) => {
    const b = route.request().postDataJSON();
    if (b.action === 'submit') { liftCalls++; liftPolls = 0; return route.fulfill(refuse ? stub(refuse, 429) : stub({ id: 'fc-LIFTLIFTLIFT' })); }
    liftPolls++;
    const stages = [undefined, 'cutting', 'shape', 'colour'];
    route.fulfill(liftPolls <= stages.length ? stub({ state: 'running', stage: stages[liftPolls - 1] }) : stub({ state: 'done', glb: 'Z2xURg==', mesh: { height_m: 0.9 }, privacy: {} }));
  });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://localhost:${port}/?mode=communities&welcome=0`, { timeout: 120000, waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', null, { timeout: 90000 });
  checks.navMarked = await page.$eval('#sitenav [data-feature=community]', (e) => e.getAttribute('aria-current') === 'page');
  checks.tabs = (await page.$$eval('.com .tabs button', (b) => b.map((x) => x.textContent))).join() === 'Explore,Make your own';
  // no second way in: the Park link is gone, and courses are not made from a photo here
  checks.noParkLink = (await page.$('.com a[href*="mode=park"], .com a[href*="mode=gallery"]')) === null && !/from a photo \(Park\)|Photo courses/.test(await page.textContent('.com'));
  // Explore comes first: premade courses, then the Make your own button, then pieces and wallpapers
  await page.waitForSelector('#ex-courses .gal', { timeout: 60000 }); await page.waitForTimeout(1200);
  checks.exploreFirst = (await page.getAttribute('.com', 'data-tab')) === 'explore' && (await page.$('#cfile')) === null;
  checks.premadeCourses = (await page.$$('#ex-courses .gal button')).length >= 1;
  const order = await page.$$eval('.com > div > .panel', (n) => n.map((x) => x.id));
  checks.orderCoursesButtonObjects = order.join() === 'ex-courses,ex-make,ex-objects';
  checks.noGalleryMakeLink = (await page.$('#make')) === null;
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
  // step 2: a click drops a box, a drag draws another: only one stays
  const r = await page.$eval('.stage img', (e) => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
  await page.mouse.click(r.x + r.w * 0.2, r.y + r.h * 0.4);
  checks.oneMark = (await page.$eval('.stage', (e) => Number(e.dataset.count))) === 1;
  await page.mouse.move(r.x + r.w * 0.55, r.y + r.h * 0.3); await page.mouse.down(); await page.mouse.move(r.x + r.w * 0.8, r.y + r.h * 0.7, { steps: 6 }); await page.mouse.up();
  checks.stillOneMark = (await page.$eval('.stage', (e) => Number(e.dataset.count))) === 1 && /Area marked/.test(await page.textContent('#cinfo'));
  checks.noPlural = !/\(s\)/.test(await page.textContent('.com'));
  checks.segmentOpen = !(await page.$eval('#cnext', (e) => e.disabled));
  await shot(page, '2-mark');
  await page.click('#cnext'); await page.waitForSelector('#cseg');
  checks.chooseLockedBeforeSegment = await page.$eval('#step-choose', (e) => e.disabled);
  checks.buttonName = (await page.textContent('#cseg')) === 'Segment Region' && /Step 3. Segment Region$/.test(await page.textContent('.panel h2'));
  // step 3a: the finder is off here: the page says so and the box is the outline (never silence)
  [W, H] = await page.$eval('.stage img', (e) => [e.naturalWidth, e.naturalHeight]);
  segOff = true; await page.click('#cseg'); await page.waitForFunction(() => /switched off/.test(document.querySelector('#cseginfo')?.textContent ?? ''), null, { timeout: 15000 });
  checks.offSaysSo = !(await page.$eval('#cnext', (e) => e.disabled));
  segOff = false;
  // step 3b: Segment Region with a stepped bar from the job's stage names
  await page.click('#cseg'); await page.waitForSelector('#cprog .jp', { timeout: 5000 });
  checks.segBarShown = (await page.$$('#cprog .jp li')).length === 3 && (await page.$('#cprog .jp [data-job-cancel]')) !== null;
  await page.waitForFunction(() => document.querySelector('#cprog .jp')?.dataset.stage === 'finding', null, { timeout: 15000 });
  await shot(page, '3-segment-progress');
  await page.waitForFunction(() => /Found \d+ thing/.test(document.querySelector('#cseginfo')?.textContent ?? ''), null, { timeout: 30000 });
  checks.segmentedOnce = segCalls === 2;
  checks.found = (await page.$$('#cfound label')).length >= 2 && (await page.$$('#cfound input:checked')).length === 1;
  checks.cutouts = (await page.$$('.stage .box.cut')).length >= 1;
  const order1 = await page.$$eval('#cfound label', (n) => n.map((x) => x.textContent));
  await page.hover('#cfound label:nth-child(2)'); await page.waitForTimeout(150); await page.hover('#cfound label:nth-child(1)'); await page.mouse.click(5, 5);
  checks.stableOrder = JSON.stringify(order1) === JSON.stringify(await page.$$eval('#cfound label', (n) => n.map((x) => x.textContent)));
  await page.hover('#cfound label:nth-child(2)'); await page.waitForTimeout(150);
  checks.hoverHighlights = (await page.$$('.stage .box.hl')).length === 1;
  await page.check('#found-1'); await page.uncheck('#found-1');
  checks.tickSeveral = true;
  await shot(page, '4-segment-result');
  // step 4: the area becomes a 3D piece
  await page.click('#cnext'); await page.waitForSelector('.item');
  checks.makeLocked = await page.$eval('#cnext', (e) => e.disabled);
  const ids = await page.$$eval('.item', (n) => n.map((x) => x.dataset.id));
  checks.oneItem = ids.length === 1;
  await page.fill(`#cname-${ids[0]}`, 'bench');
  await page.click(`#choose-piece-${ids[0]}`);
  checks.makeOpen = !(await page.$eval('#cnext', (e) => e.disabled));
  await shot(page, '5-choose');
  await page.click('#cnext'); await page.waitForSelector(`#gen-${ids[0]}`);
  // step 5a: a refused request says why and when, as a clock time, and the button waits
  refuse = { error: 'daily', message: 'x', retryAfterSeconds: 3 * 3600 };
  await page.click(`#gen-${ids[0]}`); await page.waitForFunction((id) => /Try again/.test(document.querySelector(`#cmsg-${id}`)?.textContent ?? ''), ids[0], { timeout: 15000 });
  const said = await page.textContent(`#cmsg-${ids[0]}`);
  checks.personalLimit = /all of your 3D pieces for today/.test(said) && /Try again (tomorrow at |on \d+ \w+ at |at )\d\d:\d\d\./.test(said);
  checks.buttonWaits = await page.$eval(`#gen-${ids[0]}`, (e) => e.disabled);
  await shot(page, '6-rate-limit');
  // a fresh visit, skipping the finder: the global daily refusal says it is everyone's, not yours
  const toMake = async () => {
    await page.goto(`http://localhost:${port}/?mode=communities&welcome=0`, { waitUntil: 'domcontentloaded' }); await page.waitForSelector('#make-own');
    await page.click('#make-own'); await page.click('img[data-sample=park01]'); await page.waitForSelector('.stage img'); await page.waitForTimeout(400);
    const q = await page.$eval('.stage img', (e) => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
    await page.mouse.click(q.x + q.w * 0.3, q.y + q.h * 0.5); await page.click('#cnext'); await page.click('#cskip'); await page.click('#cnext'); await page.waitForSelector('.item');
    const id = await page.$eval('.item', (n) => n.dataset.id);
    await page.fill(`#cname-${id}`, 'bench'); await page.click(`#choose-piece-${id}`); await page.click('#cnext'); await page.waitForSelector(`#gen-${id}`);
    return id;
  };
  let id2 = await toMake();
  refuse = { error: 'budget', message: 'x', retryAfterSeconds: 7200 };
  await page.click(`#gen-${id2}`); await page.waitForFunction((id) => /Try again/.test(document.querySelector(`#cmsg-${id}`)?.textContent ?? ''), id2, { timeout: 15000 });
  checks.globalLimit = /Everyone together/.test(await page.textContent(`#cmsg-${id2}`));
  refuse = { error: 'busy', message: 'x', retryAfterSeconds: 120 };
  id2 = await toMake();
  await page.click(`#gen-${id2}`); await page.waitForFunction((id) => /Try again/.test(document.querySelector(`#cmsg-${id}`)?.textContent ?? ''), id2, { timeout: 15000 });
  checks.busyLimit = /a lot in a short time/.test(await page.textContent(`#cmsg-${id2}`)) && !(await page.$eval(`#gen-${id2}`, (e) => e.disabled));
  // step 5b: Generate Piece with a stepped bar, seconds and Cancel
  refuse = null;
  await page.click(`#gen-${id2}`);
  checks.notSilent = await page.$eval(`#gen-${id2}`, (e) => e.disabled && /Making/.test(e.textContent)) && (await page.$$('.jp li')).length === 5;
  const seen = new Set();
  for (let i = 0; i < 60 && !seen.has('colour'); i++) { seen.add(await page.$eval('.jp', (e) => e.dataset.stage)); await page.waitForTimeout(500); }
  checks.stagesFollowJob = ['cutting', 'shape', 'colour'].every((x) => seen.has(x));
  await shot(page, '7-progress');
  await page.waitForFunction((id) => /Done/.test(document.querySelector(`#cmsg-${id}`)?.textContent ?? ''), id2, { timeout: 60000 });
  await page.waitForSelector('#prize', { timeout: 20000 }); checks.prizeShown = (await page.$('#prize-keep')) !== null && (await page.$('#prize-editor')) !== null; await shot(page, '8-prize'); await page.click('#prize-keep'); await page.waitForSelector('#prize', { state: 'detached' });
  checks.generated = liftCalls >= 2 && (await page.$eval('.jp', (e) => e.dataset.stage)) === 'done';
  checks.whatNext = (await page.$('#go-editor')) !== null;
  checks.pieceKept = await page.evaluate(async () => { const db = await new Promise((ok, no) => { const q = indexedDB.open('cc-user-objects', 1); q.onsuccess = () => ok(q.result); q.onerror = no; }); return await new Promise((ok) => { const t = db.transaction(db.objectStoreNames[0]).objectStore(db.objectStoreNames[0]).count(); t.onsuccess = () => ok(t.result > 0); t.onerror = () => ok(false); }); });
  await shot(page, '8-what-next');
  // wallpaper path, tabs, and the old addresses
  await page.click('#step-choose'); await page.click(`#choose-piece-${id2}`); await page.click(`#choose-wall-${id2}`); await page.click('#cnext');
  await page.click(`#wsave-${id2}`); await page.waitForFunction((id) => /Saved/.test(document.querySelector(`#cmsg-${id}`)?.textContent ?? ''), id2, { timeout: 10000 });
  checks.courseLink = /wallpaper=w/.test((await page.getAttribute('#go-course', 'href')) ?? '');
  await page.click('#go-objects'); await page.waitForTimeout(1500);
  checks.yoursShown = (await page.$$eval('#objgrid .card strong', (n) => n.filter((x) => /^Yours:/.test(x.textContent)).length)) >= 2;
  await page.click('#tab-make'); checks.workKept = (await page.getAttribute('.panel', 'data-step')) === 'make';
  for (const m of ['gallery', 'park']) { await page.goto(`http://localhost:${port}/?mode=${m}&welcome=0`, { waitUntil: 'domcontentloaded' }); await page.waitForSelector('.com[data-tab=explore]', { timeout: 60000 }); }
  checks.oldAddressesOpenExplore = true;
  console.log(checks, 'errors:', errors);
  const bad = Object.entries(checks).filter(([, v]) => v !== true).map(([k]) => k);
  if (bad.length || errors.length) { console.log('FAILED', bad); process.exitCode = 1; }
  await browser.close();
} finally { server.kill(); }
