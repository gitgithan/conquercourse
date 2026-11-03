// CC-133: "Mark it yourself" in the Community Pick step, 1280 px desktop. No network service is needed: the tool is used before any Segment Objects run.
// Run: PHOTO=/path/to/photo.jpg BASE=http://localhost:5173 node scripts/markbox-check.mjs out-dir
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'test-results/markbox'; mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:5173';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const page = await b.newPage({ viewport: { width: 1280, height: 900 } });
const checks = {};
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
await page.click('#markuse'); await page.waitForSelector('#cfound .found label');
checks.markedInList = (await page.$$eval('#cfound .found label span', (n) => n.map((x) => x.textContent))).join('|');
checks.ticked = await page.$eval('#found-0', (e) => e.checked);
checks.nextEnabled = !(await page.$eval('#cnext', (e) => e.disabled));
checks.drawnBoxShown = (await page.$$('.stage .box')).length === 1;
await page.screenshot({ path: `${out}/3-added.png` });
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
