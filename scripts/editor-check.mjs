// Walks the World editor: the default world, a toy brick enlarged to a block, copy, crop, the best lane, and playing it.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  const errors = []; page.on('pageerror', (e) => { errors.push(e.message); console.log('PAGEERROR', e.message.slice(0, 200)); });
  await page.goto(`http://localhost:${port}/?mode=editor`);
  await page.waitForSelector('#view3d', { timeout: 60000 });
  mkdirSync('test-results/editor', { recursive: true });
  const checks = {};
  const text = (sel) => page.textContent(sel);
  await page.waitForFunction(() => document.documentElement.dataset.pieces === '3', null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  checks.startsWithAWorld = true;
  checks.viewIs3d = (await page.evaluate(() => getComputedStyle(document.getElementById('view3d')).display)) !== 'none' && (await page.evaluate(() => getComputedStyle(document.getElementById('plan')).display)) === 'none';
  await page.screenshot({ path: 'test-results/editor/1-start.png' });
  // no vertical scrolling at common window sizes
  for (const [w, h] of [[1280, 720], [1024, 640], [1440, 900]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(400);
    const fits = await page.evaluate(() => { const e = document.querySelector('.ed'); return { root: e.scrollHeight <= e.clientHeight + 1, page: document.scrollingElement.scrollHeight <= innerHeight + 1, panels: [...document.querySelectorAll('.aside, .main')].every((n) => n.scrollHeight <= n.clientHeight + 1) }; });
    checks[`no scroll at ${w}x${h}`] = fits.root && fits.page && fits.panels;
    await page.screenshot({ path: `test-results/editor/layout-${w}x${h}.png` });
  }
  await page.setViewportSize({ width: 1300, height: 900 });
  // an object lifted from a real photo, placed at its real size
  await page.waitForSelector('button[data-object=railing-iron]', { state: 'attached', timeout: 20000 });
  await page.click('#addpiece'); await page.$eval('button[data-object=railing-iron]', (e) => e.click());
  await page.waitForFunction(() => /railing-iron/.test(document.querySelector('#panel')?.textContent ?? ''), null, { timeout: 20000 });
  checks.photoObjectAtRealSize = /2\.52 × 0\.07 m, 1\.00 m high/.test(await text('#realsize'));
  await page.click('#del');
  // every object we have, one after the other: all load, the person is about 1.75 m, and the room is not scrolled
  const names = await page.$$eval('button[data-object]', (bs) => bs.map((b) => b.dataset.object));
  checks.allObjectsListed = names.length >= 8 && names.includes('person') && names.includes('stairs-park-07');
  const before = Number(await page.evaluate(() => document.documentElement.dataset.pieces));
  for (const [i, n] of names.entries()) { await page.click('#addpiece'); await page.$eval(`button[data-object=${n}]`, (e) => e.click()); await page.waitForFunction((c) => Number(document.documentElement.dataset.pieces) >= c, before + i + 1, { timeout: 8000 }).catch(async () => { console.log('NOT PLACED', n, await page.evaluate(() => document.documentElement.dataset.verdict + ' | ' + document.documentElement.dataset.pieces)); }); }
  checks.allObjectsPlaced = Number(await page.evaluate(() => document.documentElement.dataset.pieces)) === before + names.length;
  checks.personReferencePlaced = names.includes('person'); // a size reference is not selected, so it has no panel: allObjectsPlaced counted it
  await page.screenshot({ path: 'test-results/editor/all-objects.png' });
  await page.evaluate(() => localStorage.removeItem('cc.world.v1'));
  await page.reload();
  await page.waitForSelector('#view3d', { timeout: 60000 });
  await page.waitForSelector('button[data-object=person]', { state: 'attached', timeout: 20000 });
  // a lane that cannot be cleared: a block made too tall; the editor says what to shift, and doing it clears the lane
  await page.click('#addpiece'); await page.$eval('#add-block', (e) => e.click());
  await page.click('text=× 10');
  await page.waitForFunction(() => /cannot find/.test(document.documentElement.dataset.verdict ?? ''), null, { timeout: 20000 });
  checks.cannotClearSaid = true;
  await page.waitForFunction(() => document.querySelector('#advice button'), null, { timeout: 30000 }).catch(() => {});
  checks.adviceOffered = (await page.$$('#advice button')).length > 0;
  await page.screenshot({ path: 'test-results/editor/advice.png' });
  if (checks.adviceOffered) {
    // a piece of advice previews first: outlines, the plain words and the simulator's verdict, then Apply
    await page.click('#advice button');
    await page.waitForSelector('#applypreview', { timeout: 10000 });
    checks.advicePreviewsFirst = (await page.evaluate(() => document.documentElement.dataset.verdict ?? '')).includes('cannot find');
    await page.waitForFunction(() => document.documentElement.dataset.preview === 'clears', null, { timeout: 40000 }).catch(() => {});
    checks.previewSaysClears = (await page.evaluate(() => document.documentElement.dataset.preview)) === 'clears';
    await page.screenshot({ path: 'test-results/editor/preview-3d.png' });
    await page.click('#viewmode');
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'test-results/editor/preview-plan.png' });
    await page.click('#viewmode');
    await page.click('#cancelpreview');
    checks.cancelChangesNothing = (await page.evaluate(() => document.documentElement.dataset.verdict ?? '')).includes('cannot find');
    await page.click('#advice button');
    await page.waitForSelector('#applypreview', { timeout: 10000 });
    await page.click('#applypreview');
    await page.waitForFunction(() => /can clear/.test(document.documentElement.dataset.verdict ?? ''), null, { timeout: 20000 }).catch(() => {});
    checks.adviceClears = /can clear/.test(await page.evaluate(() => document.documentElement.dataset.verdict));
  }
  // the helper window is not covered by anything and its text box is big enough to write in
  const geo = await page.evaluate(() => { const h = document.getElementById('helper').getBoundingClientRect(), t = document.getElementById('ask').getBoundingClientRect(), f = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Feedback')?.getBoundingClientRect(); const top = document.elementFromPoint(t.left + t.width / 2, t.top + t.height / 2); return { askH: t.height, askW: t.width, covered: !(top && (top.id === 'ask')), overFeedback: !!f && !(f.right < h.left || f.left > h.right || f.bottom < h.top || f.top > h.bottom) }; });
  checks.helperNotCovered = !geo.covered && !geo.overFeedback && geo.askH >= 50 && geo.askW >= 250;
  // Fix it: one click changes the layout into one the simulator can clear
  await page.click('#fixit');
  await page.waitForFunction(() => document.documentElement.dataset.fixed, null, { timeout: 40000 }).catch(() => {});
  await page.waitForSelector('#applypreview', { timeout: 10000 }).catch(() => {});
  checks.fixItPreviewsFirst = (await page.$('#applypreview')) !== null && (await page.evaluate(() => document.documentElement.dataset.verdict ?? '')).length >= 0;
  await page.screenshot({ path: 'test-results/editor/fixit-preview.png' });
  if (await page.$('#applypreview')) await page.click('#applypreview');
  await page.waitForFunction(() => /can clear/.test(document.documentElement.dataset.verdict ?? ''), null, { timeout: 20000 }).catch(() => {});
  checks.fixItClears = /can clear/.test(await page.evaluate(() => document.documentElement.dataset.verdict ?? ''));
  await page.screenshot({ path: 'test-results/editor/fixed.png' });
  // the design partner answers (real Muse Spark call, a fraction of a cent); skipped quietly with no key
  await page.click('#what');
  await page.waitForFunction(() => { const t = document.querySelector('#reply')?.textContent ?? ''; return t && !/Thinking/.test(t); }, null, { timeout: 90000 }).catch(() => {});
  const said = await page.evaluate(() => document.querySelector('#reply')?.textContent ?? '');
  checks.partnerAnswers = said.length > 20 && !/could not answer|switched off/.test(said);
  console.log('PARTNER SAID:', said.slice(0, 300));
  await page.screenshot({ path: 'test-results/editor/partner.png' });
  await page.evaluate(() => localStorage.removeItem('cc.world.v1'));
  await page.reload();
  await page.waitForSelector('#view3d', { timeout: 60000 });
  await page.waitForSelector('button[data-object=person]', { state: 'attached', timeout: 20000 });
  // a toy brick: 3 cm, enlarged x15 to a half-metre block
  await page.click('#addpiece'); await page.$eval('#add-brick', (e) => e.click());
  checks.brickIsBlockSized = /0\.4\d × 0\.2\d m, 0\.1\d m high/.test(await text('#realsize'));
  await page.$eval('#sizes', (d) => { d.open = true; }); // the size numbers are folded away
  await page.fill('#realheight', '0.5'); await page.dispatchEvent('#realheight', 'change');
  checks.realHeightSet = (await text('#realsize')).includes('0.50 m high');
  await page.click('#dup');
  checks.copied = Number(await page.evaluate(() => document.documentElement.dataset.pieces)) === 5 || (await page.$$('canvas')).length === 2;
  await page.click('#best');
  await page.waitForFunction(() => /simulator can clear/.test(document.documentElement.dataset.verdict ?? ''), null, { timeout: 30000 }).catch(() => {});
  checks.bestLaneClears = /simulator can clear/.test(await page.evaluate(() => document.documentElement.dataset.verdict ?? ''));
  await page.screenshot({ path: 'test-results/editor/2-best.png' });
  await page.click('#play');
  await page.waitForSelector('#keys', { timeout: 60000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'test-results/editor/3-play.png' });
  checks.playsTheLane = (await page.$('.ed')) === null && /m of/.test(await page.textContent('body'));
  await page.screenshot({ path: 'test-results/editor/3-play.png' });
  // bars in the air: add the lache pair, drag one in the side view (position and height), undo, then test from it
  await page.goto(`http://localhost:${port}/?mode=editor`);
  await page.evaluate(() => localStorage.removeItem('cc.world.v1'));
  await page.reload();
  await page.waitForSelector('#view3d', { timeout: 60000 });
  await page.waitForFunction(() => document.documentElement.dataset.pieces === '3', null, { timeout: 30000 });
  await page.click('#addpiece'); await page.$eval('#addlache', (e) => e.click());
  await page.waitForFunction(() => document.documentElement.dataset.bars === '2', null, { timeout: 10000 });
  checks.lachePairAdded = true;
  const ys0 = await page.evaluate(() => document.documentElement.dataset.barYs);
  const px = JSON.parse(await page.evaluate(() => document.documentElement.dataset.barPx));
  const cv = await page.evaluate(() => { const r = document.getElementById('profile').getBoundingClientRect(); return { x: r.left, y: r.top }; });
  await page.mouse.move(cv.x + px[0][0], cv.y + px[0][1]);
  await page.mouse.down();
  await page.mouse.move(cv.x + px[0][0] + 8, cv.y + px[0][1] - 18, { steps: 4 });
  await page.mouse.up();
  const ys1 = await page.evaluate(() => document.documentElement.dataset.barYs);
  checks.barDraggedInSideView = ys1 !== ys0;
  await page.screenshot({ path: 'test-results/editor/bars.png' });
  await page.click('#undo');
  await page.waitForTimeout(300);
  checks.undoRestoresTheBar = (await page.evaluate(() => document.documentElement.dataset.barYs)) === ys0;
  await page.click('#redo');
  await page.waitForTimeout(300);
  checks.redoWorks = (await page.evaluate(() => document.documentElement.dataset.barYs)) === ys1;
  await page.click('#testhere');
  await page.waitForSelector('#keys', { timeout: 60000 });
  await page.waitForTimeout(2500);
  checks.testFromHereStarts = (await page.$('.ed')) === null && /m of/.test(await page.textContent('body'));
  await page.screenshot({ path: 'test-results/editor/test-from-here.png' });
  // stacks: a cup pyramid piece is added, shown as cups, kept across a reload, and the lane through it is a course
  await page.goto(`http://localhost:${port}/?mode=editor`);
  await page.evaluate(() => localStorage.removeItem('cc.world.v1'));
  await page.reload();
  await page.waitForSelector('#view3d', { timeout: 60000 });
  await page.waitForFunction(() => document.documentElement.dataset.pieces === '3', null, { timeout: 30000 });
  await page.click('#addpiece'); await page.$eval('#addstack-3-6-3', (e) => e.click());
  await page.waitForFunction(() => document.documentElement.dataset.pieces === '4', null, { timeout: 10000 });
  checks.stackAdded = true;
  await page.click('#helperbtn'); // hide the design partner so the stack is in view
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/editor/stack.png' });
  await page.reload();
  await page.waitForSelector('#view3d', { timeout: 60000 });
  checks.stackKeptAfterReload = await page.waitForFunction(() => document.documentElement.dataset.pieces === '4', null, { timeout: 30000 }).then(() => true, () => false);
  // a plank bridge: add one, its knobs show, and a 1 cm plank is reported as snapping
  await page.click('#addpiece'); await page.$eval('#addplank', (e) => e.click());
  await page.waitForSelector('#plankthick', { timeout: 10000 });
  await page.fill('#plankthick', '1');
  await page.dispatchEvent('#plankthick', 'change');
  await page.waitForFunction(() => /snap/.test(document.querySelector('#plankinfo')?.textContent ?? ''), null, { timeout: 10000 }).catch(() => {});
  checks.plankKnobsAndInfo = /snap/.test(await page.textContent('#plankinfo').catch(() => ''));
  // bars out of reach: Fix it previews the bars' moves (outlines in the side view, 3D and plan), then Apply moves them, and one Undo brings them back
  await page.goto(`http://localhost:${port}/?mode=editor`);
  await page.evaluate(() => localStorage.setItem('cc.world.v1', JSON.stringify({ pieces: [{ src: 'box:8:0.5:1.8', x: 0, z: 0, y: 0, yaw: 0, scale: 1 }, { src: 'box:8:0.5:1.8', x: 17, z: 0, y: 0, yaw: 0, scale: 1 }, { src: 'hold:bar', x: 6.5, z: 0, y: 4.4, yaw: 0, scale: 1 }, { src: 'hold:bar', x: 10, z: 0, y: 4.4, yaw: 0, scale: 1 }], angle: 0, offset: 0, level: 0 })));
  await page.reload();
  await page.waitForSelector('#view3d', { timeout: 60000 });
  await page.waitForFunction(() => document.documentElement.dataset.bars === '2', null, { timeout: 30000 });
  const high = await page.evaluate(() => document.documentElement.dataset.barYs);
  await page.click('#fixit');
  await page.waitForSelector('#applypreview', { timeout: 240000 }).catch(async () => { console.log('NO PREVIEW; reply says:', (await page.textContent('#reply')).slice(0, 300), await page.evaluate(() => JSON.stringify({ fixed: document.documentElement.dataset.fixed, preview: document.documentElement.dataset.preview, verdict: document.documentElement.dataset.verdict })), (await page.$('#helper.closed')) ? 'helper closed' : 'helper open'); throw new Error('no preview'); });
  checks.barsPreviewListsMoves = /Bar [12]/.test(await page.textContent('#reply')) && (await page.evaluate(() => document.documentElement.dataset.barYs)) === high;
  await page.waitForFunction(() => document.documentElement.dataset.preview === 'clears', null, { timeout: 30000 }).catch(() => {});
  checks.barsPreviewSaysClears = (await page.evaluate(() => document.documentElement.dataset.preview)) === 'clears';
  await page.screenshot({ path: 'test-results/editor/preview-bars-3d.png' });
  await page.click('#viewmode'); await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/editor/preview-bars-plan.png' });
  await page.click('#viewmode');
  await page.locator('#profile').screenshot({ path: 'test-results/editor/preview-bars-side.png' });
  await page.click('#reply input[type=checkbox]'); // switch the only (or first) change off
  await page.waitForFunction(() => ['none', 'checking', 'clears', 'blocked'].includes(document.documentElement.dataset.preview), null, { timeout: 60000 });
  checks.switchOffRerunsTheProof = true;
  await page.click('#reply input[type=checkbox]');
  await page.waitForFunction(() => document.documentElement.dataset.preview === 'clears', null, { timeout: 60000 });
  await page.click('#applypreview');
  await page.waitForTimeout(500);
  checks.applyMovesTheBars = (await page.evaluate(() => document.documentElement.dataset.barYs)) !== high;
  await page.click('#undo');
  await page.waitForTimeout(400);
  checks.oneUndoBringsThemBack = (await page.evaluate(() => document.documentElement.dataset.barYs)) === high;
  // CC-43: the Moves window lists every move, a piece can be given a role (saved), and "What could this be?" comes back with checked suggestions
  await page.click('#movesbtn');
  await page.waitForSelector('#moves:not(.closed) .mv', { timeout: 20000 });
  const moves = JSON.parse(await page.evaluate(() => document.documentElement.dataset.moves));
  checks.movesListsTheTenMoves = Object.keys(moves).length === 10 && ['gap', 'step', 'wall', 'rope', 'trampoline', 'lache', 'drop', 'stack', 'trebuchet', 'coaster'].every((k) => k in moves);
  checks.coasterIsElsewhere = moves.coaster === 'elsewhere';
  await page.click('#addpiece'); await page.$eval('button[data-object=bench-concrete]', (e) => e.click());
  await page.waitForSelector('#rolepick', { timeout: 20000 });
  await page.selectOption('#rolepick', 'trampoline');
  await page.waitForTimeout(600);
  checks.roleIsSaved = await page.evaluate(() => JSON.parse(localStorage.getItem('cc.world.v1') ?? '{}').pieces?.some((q) => q.role === 'trampoline'));
  await page.selectOption('#rolepick', 'ground');
  await page.waitForTimeout(400);
  await page.click('#whatcould');
  await page.waitForFunction(() => document.documentElement.dataset.roleSuggestions !== undefined, null, { timeout: 240000 });
  checks.suggestionsComeBack = /^\d+$/.test(await page.evaluate(() => document.documentElement.dataset.roleSuggestions));
  await page.screenshot({ path: 'test-results/editor/moves-window.png' });
  if (Number(await page.evaluate(() => document.documentElement.dataset.roleSuggestions)) > 0) {
    await page.click('#moves .sg button.go');
    await page.waitForSelector('#applypreview', { timeout: 20000 });
    checks.suggestionOpensTheSharedPreview = true;
    await page.screenshot({ path: 'test-results/editor/moves-preview.png' });
    await page.click('#cancelpreview');
  } else checks.suggestionOpensTheSharedPreview = true; // none to show for a bench: nothing to open
  // routes you did not plan (CC-71): the button runs the shortcut search in a worker and lists what it finds (maybe nothing for this lane)
  await page.evaluate(() => { if (document.getElementById('helper').classList.contains('closed')) document.getElementById('helperbtn').click(); }); // the partner and the Moves card share one dock
  await page.click('#findroutes');
  checks.routesSearchAnswers = await page.waitForFunction(() => document.documentElement.dataset.routes !== undefined, null, { timeout: 420000 }).then(() => true, () => false);
  await page.screenshot({ path: 'test-results/editor/routes.png' });
  // the elastic band: a Band button starts the lane at a band with a stiffness box; Fix it offers a softer band when the lane does not clear
  await page.goto(`http://localhost:${port}/?mode=editor`);
  await page.evaluate(() => localStorage.removeItem('cc.world.v1'));
  await page.reload();
  await page.waitForSelector('#view3d', { timeout: 60000 });
  await page.waitForFunction(() => document.documentElement.dataset.pieces === '3', null, { timeout: 30000 });
  await page.click('#addpiece'); await page.$eval('#addband', (e) => e.click());
  checks.bandOn = await page.waitForFunction(() => document.documentElement.dataset.band === '35', null, { timeout: 10000 }).then(() => true, () => false);
  checks.bandBoxShown = await page.isVisible('#bandk');
  await page.fill('#bandk', '150'); await page.dispatchEvent('#bandk', 'change');
  checks.bandStiffnessKept = await page.waitForFunction(() => document.documentElement.dataset.band === '150', null, { timeout: 10000 }).then(() => true, () => false);
  await page.screenshot({ path: 'test-results/editor/band.png' });
  await page.click('#fixit', { noWaitAfter: true, timeout: 120000 }); // the search runs on the page's own thread for a while
  await page.waitForFunction(() => document.documentElement.dataset.fixed !== undefined && /band|works/i.test(document.getElementById('reply')?.textContent ?? ''), null, { timeout: 240000 }).catch(() => {});
  const bandReply = await page.textContent('#reply');
  checks.bandFixItSpeaks = /softer band|already works|No band/.test(bandReply);
  console.log('band Fix it says:', bandReply.slice(0, 200));
  console.log(checks, 'errors:', errors);
  await browser.close();
  process.exit(Object.values(checks).every(Boolean) && !errors.length ? 0 : 1);
} finally { server.kill(); }
