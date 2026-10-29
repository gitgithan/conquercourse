// CC-138: a phone-sized touch browser opens a challenge link; a computer is unaffected. One browser at a time.
import { chromium, devices } from 'playwright';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'test-results/share-phone'; mkdirSync(out, { recursive: true });
const port = Number(process.env.PORT ?? 5884);
const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 6000));
const link = execFileSync('node_modules/.bin/tsx', ['scripts/share-link.ts', 'public/assets/demo/lache.course.json', `http://localhost:${port}`]).toString().trim();
const results = []; const ok = (n, p, note = '') => { results.push(p); console.log(p ? 'PASS' : 'FAIL', n, note); };
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const errs = [];
const phone = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'] });
const p = await phone.newPage(); p.on('pageerror', (e) => errs.push(String(e)));
await p.goto(`${link}&welcome=0&tour=0`, { waitUntil: 'load' });
const banner = await p.waitForSelector('#challenge-banner', { timeout: 60000 }).then((e) => e.innerText()).catch(() => '');
ok('the notice says to play it on a computer', /Play it on a computer to beat it/.test(banner) && /\d+\.\d\d s/.test(banner), banner.replace(/\n/g, ' | '));
ok('a Copy link button is there', /Copy link/.test(banner));
const progress = () => p.evaluate(() => (document.body.innerText.match(/(\d+) m of \d+ m/) ?? [])[1] ?? '0');
const seen = new Set(); for (let i = 0; i < 6; i++) { await p.waitForTimeout(2500); seen.add(await progress()); }
ok('the run plays by itself', seen.size >= 3, [...seen].join(', ') + ' m');
const keysCard = await p.evaluate(() => { const e = [...document.querySelectorAll('*')].find((x) => /^Controls/.test(x.textContent?.trim() ?? '') && x.children.length < 6 && x.offsetParent); return e ? e.getBoundingClientRect().height : 0; });
ok('the long keys card does not cover the course', keysCard < 120, `${Math.round(keysCard)} px`);
await p.waitForTimeout(25000); // past the end of the 9 s run: it starts again, no report and no What next card
const covered = await p.evaluate(() => /What next|Try again/.test(document.body.innerText));
const again = Number(await progress());
ok('at the end the run starts again, with no report on top', !covered && again < 56, `${again} m, report showing: ${covered}`);
ok('the notice stays on screen', !!(await p.$('#challenge-banner')));
await p.screenshot({ path: `${out}/phone-notice.png` });
await p.evaluate(() => [...document.querySelectorAll('#challenge-banner button')].find((x) => /Copy link/.test(x.textContent)).click());
await p.waitForTimeout(500);
const copied = await p.evaluate(() => navigator.clipboard.readText()).catch(() => '');
ok('the button copies this link', /challenge=1\./.test(copied), copied.slice(0, 90));
const gone = await p.evaluate(() => [...document.querySelectorAll('#challenge-banner button')].some((x) => /copied/i.test(x.textContent)));
ok('the button says it copied', gone);
// a computer is unaffected
const desk = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); desk.on('pageerror', (e) => errs.push(String(e)));
await desk.goto(`${link}&welcome=0&tour=0`, { waitUntil: 'load' });
const db = await desk.waitForSelector('#challenge-banner', { timeout: 60000 }).then((e) => e.innerText()).catch(() => '');
ok('a computer still gets "Beat this time"', /Beat this time: \d+\.\d\d s/.test(db) && !/Play it on a computer/.test(db), db.replace(/\n/g, ' | '));
ok('no page errors', errs.length === 0, errs.join(' | ').slice(0, 300));
await b.close(); vite.kill(); process.exit(results.every(Boolean) ? 0 : 1);
