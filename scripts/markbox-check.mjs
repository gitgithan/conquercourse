// CC-133: "Mark it yourself" in the Community Pick step, 1280 px desktop: drag, name, SEE THE CUT-OUT, then Use this or Redraw; nothing is lifted before Use this.
// The server is stubbed: /api/segment answers with a REAL cut-out picture made by the deployed Modal app for photo 2's monkey bars (docs/evidence/cc-133-markbox/monkey-bars-cutout.png).
// The stub places it inside the box that was sent, with the same inset as the real answer (sent 551,288,1222,349 and answered 573,290,1221,344 on a 1280 x 960 photo). Every /api/object-lift call is counted and must be 0 here.
// Run: PHOTO=/path/to/photo.jpg BASE=http://localhost:5173 node scripts/markbox-check.mjs out-dir
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
const out = process.argv[2] ?? 'test-results/markbox'; mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:5173';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const page = await b.newPage({ viewport: { width: 1280, height: 900 } });
const checks = {};
const CUT = readFileSync(new URL('../docs/evidence/cc-133-markbox/monkey-bars-cutout.png', import.meta.url)).toString('base64');
let lifts = 0, segCalls = [], mode = 'good'; // good: a real cut-out; empty: no clear shape
await page.route('**/api/object-lift', (r) => { lifts++; r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"off"}' }); });
await page.route('**/api/segment', (r) => {
  const b = JSON.parse(r.request().postData() ?? '{}');
  if (b.action === 'submit') { segCalls.push(b.box ?? null); return r.fulfill({ contentType: 'application/json', body: '{"id":"fc-abcdefghij12"}' }); }
  if (b.action === 'warm') return r.fulfill({ status: 204 });
  const [x0, y0, x1, y1] = segCalls.at(-1); const w = x1 - x0, h = y1 - y0;
  const item = { label: 'thing', score: 0.91, box: [Math.round(x0 + 0.033 * w), Math.round(y0 + 0.03 * h), Math.round(x1 - 0.0015 * w), Math.round(y1 - 0.08 * h)], cutout: CUT };
  r.fulfill({ contentType: 'application/json', body: JSON.stringify({ state: 'done', items: mode === 'good' ? [item] : [], privacy: { person_boxes: [] }, seconds: 0.5 }) });
});
await page.goto(`${base}/?mode=communities&welcome=0&tab=make`); await page.waitForSelector('#step-photo', { timeout: 60000 });
await page.setInputFiles('input[type=file]', process.env.PHOTO); await page.waitForSelector('#cseg', { timeout: 60000 });
await page.waitForSelector('.stage img'); await page.waitForTimeout(500);
checks.buttonThere = (await page.$('#cmark')) !== null;
await page.click('#cmark'); await page.waitForSelector('#markzone');
const rectOf = () => page.$eval('.stage img', (i) => { const x = i.getBoundingClientRect(); return { x: x.x, y: x.y, w: x.width, h: x.height }; });
let r = await rectOf();
// photo 2: the monkey bars are the overhead bar loops in the upper right (about 44 to 97 percent across, 26 to 43 percent down)
const p = (fx, fy) => [r.x + fx * r.w, r.y + fy * r.h];
const [x0, y0] = p(0.44, 0.26), [x1, y1] = p(0.97, 0.43);
await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 6 }); await page.mouse.move(x1, y1, { steps: 6 });
await page.screenshot({ path: `${out}/1-dragging.png` });
await page.mouse.up(); await page.waitForSelector('#markname');
checks.nameAsked = true;
await page.click('#markname button[data-label=bar]');
await page.screenshot({ path: `${out}/2-named.png` });
await page.click('#markuse'); await page.waitForSelector('#muse');
// the cut-out is shown and NOT ticked; Next is off; nothing was lifted
checks.cutOutShown = (await page.$$('.stage .box.cut')).length === 1;
checks.cutOutLit = await page.$eval('.stage .box.cut', (e) => e.classList.contains('hl'));
checks.waitingNotTicked = !(await page.$eval('#found-0', (e) => e.checked)) && await page.$eval('#found-0', (e) => e.disabled);
checks.nextDisabledBeforeUse = await page.$eval('#cnext', (e) => e.disabled);
checks.boxSentToFinder = JSON.stringify(segCalls);
await page.click('.stage .box.cut'); // a click on the outline must not pick it before Use this
checks.clickDoesNotPick = !(await page.$eval('#found-0', (e) => e.checked));
checks.liftsBeforeUse = lifts;
await page.screenshot({ path: `${out}/3-cutout.png` });
// Redraw removes it and reopens the tool; draw again, name again
await page.click('#mredo'); await page.waitForSelector('#markzone');
checks.redrawClears = (await page.$$('.stage .box')).length === 0;
r = await rectOf(); const [a0, b0] = p(0.44, 0.26), [a1, b1] = p(0.97, 0.43);
await page.mouse.move(a0, b0); await page.mouse.down(); await page.mouse.move(a1, b1, { steps: 8 }); await page.mouse.up(); await page.waitForSelector('#markname');
await page.click('#markname button[data-label=bar]'); await page.click('#markuse'); await page.waitForSelector('#muse');
await page.click('#muse');
checks.markedInList = (await page.$$eval('#cfound .found label span', (n) => n.map((x) => x.textContent))).join('|');
checks.ticked = await page.$eval('#found-0', (e) => e.checked);
checks.nextEnabled = !(await page.$eval('#cnext', (e) => e.disabled));
checks.cutOutKept = (await page.$$('.stage .box.cut')).length === 1;
checks.liftsAfterUse = lifts;
await page.screenshot({ path: `${out}/4-used.png` });
// a reply with no clear shape is said in words, with a way to draw again, and nothing is ticked
mode = 'empty'; await page.click('#cmark'); await page.waitForSelector('#markzone'); r = await rectOf();
const [c0, d0] = p(0.10, 0.60), [c1, d1] = p(0.30, 0.80);
await page.mouse.move(c0, d0); await page.mouse.down(); await page.mouse.move(c1, d1, { steps: 4 }); await page.mouse.up(); await page.waitForSelector('#markname');
await page.click('#markname button[data-label=other]'); await page.click('#markuse'); await page.waitForSelector('#mredo');
checks.noShapeSaid = /could not outline/.test(await page.textContent('#cseginfo'));
checks.noShapeNotAdded = (await page.$$('#cfound .found label')).length === 1;
await page.screenshot({ path: `${out}/5-no-shape.png` });
await page.click('#mredo'); await page.waitForSelector('#markzone'); await page.keyboard.press('Escape'); mode = 'good';
checks.liftsTotal = lifts;
// too small is refused with words
await page.click('#cmark'); await page.waitForSelector('#markzone'); r = await rectOf();
await page.mouse.move(r.x + 50, r.y + 50); await page.mouse.down(); await page.mouse.move(r.x + 55, r.y + 54, { steps: 2 }); await page.mouse.up();
checks.tinyRefused = /too small/.test(await page.textContent('#markmsg'));
// too big
await page.mouse.move(r.x + 2, r.y + 2); await page.mouse.down(); await page.mouse.move(r.x + r.w - 2, r.y + r.h - 2, { steps: 4 }); await page.mouse.up();
checks.hugeRefused = /whole photo/.test(await page.textContent('#markmsg'));
// keyboard: Enter starts a box, arrows move, shift+arrows resize, Enter asks the name, a bad word is refused, Esc cancels
await page.focus('#markzone'); await page.keyboard.press('Enter');
const w0 = await page.$eval('#markrect', (e) => e.getBoundingClientRect().width), l0 = await page.$eval('#markrect', (e) => e.getBoundingClientRect().left);
await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
await page.keyboard.press('Shift+ArrowRight');
const w1 = await page.$eval('#markrect', (e) => e.getBoundingClientRect().width), l1 = await page.$eval('#markrect', (e) => e.getBoundingClientRect().left);
checks.keyboardMoves = l1 > l0; checks.keyboardResizes = w1 > w0;
await page.keyboard.press('Enter'); await page.waitForSelector('#marklabel');
await page.fill('#marklabel', 'x<'); await page.keyboard.press('Enter');
checks.badWordRefused = /few letters/.test(await page.textContent('#markmsg'));
await page.keyboard.press('Escape');
checks.escCloses = (await page.$('#markzone')) === null;
checks.buttonBack = await page.$eval('#cmark', (e) => !e.disabled);
console.log(JSON.stringify(checks, null, 1)); await b.close();
