// CC-108: challenge courses. A cleared run on a course that is not a ranked one shows the new end-card message;
// Publish as challenge course and Copy challenge link work; the Courses screen has a Community section; ?challenge=0 hides all of it.
// The API is answered by the script. One browser at a time. Pictures go to the folder given.
import { chromium } from 'playwright';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'test-results/challenge', port = Number(process.env.PORT ?? 5884);
mkdirSync(out, { recursive: true });
const course = process.env.COURSE ?? 'public/assets/demo/lache.course.json';
const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 6000));
const link = execFileSync('node_modules/.bin/tsx', ['scripts/share-link.ts', course, `http://localhost:${port}`], { env: { ...process.env, MADE: '1' } }).toString().trim();
const results = []; const ok = (n, p, note = '') => { results.push(p); console.log(p ? 'PASS' : 'FAIL', n, note); };
const ID = 'abcdefghjk';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
async function open(url, posts) {
  const page = await (await b.newContext({ viewport: { width: 1280, height: 720 }, permissions: ['clipboard-read', 'clipboard-write'] })).newPage();
  page.errs = []; page.on('pageerror', (e) => page.errs.push(String(e)));
  await page.route('**/api/challenge-course**', async (route) => {
    const u = new URL(route.request().url());
    if (route.request().method() === 'POST') { posts.push(JSON.parse(route.request().postData() ?? '{}')); return route.fulfill({ status: 201, json: { ok: true, id: ID, boardHash: 'x', duplicate: false, promoted: false } }); }
    if (u.searchParams.get('list')) return route.fulfill({ json: { courses: [{ id: 'bcdfghjkmn', name: 'Tall Wall Remix', players: 2, bestTicks: 1500 }] } });
    return route.fulfill({ status: 404, json: { error: 'no-course' } });
  });
  await page.route('**/api/share', (route) => route.fulfill({ status: 500, json: {} })); // the long link is used when the short one is not answered
  await page.route('**/api/leaderboard**', (route) => route.fulfill({ json: { top: [], players: 0, mine: null, resetAt: null, previous: null } }));
  await page.route('**/api/course-clear', (route) => route.fulfill({ json: { ok: true } }));
  await page.goto(url, { waitUntil: 'load' });
  return page;
}
const posts = [];
const page = await open(`${link}&welcome=0&tour=0&autoplay=1`, posts);
const strip = await page.waitForSelector('#report-challenge', { timeout: 280000 }).then(() => true, () => false);
ok('a cleared run on a non-ranked course shows the challenge strip', strip);
if (strip) {
  const say = await page.textContent('#challenge-say');
  ok('the message says why, in plain words', /can't go on the ranked board\. Publish it as a challenge course, or play the official course\./.test(say ?? ''), say ?? '');
  ok('the old "changed since your run" words are gone', !/changed since your run/.test(await page.textContent('body') ?? ''));
  const names = await page.$$eval('#report-challenge button', (bs) => bs.map((x) => x.textContent));
  ok('the two buttons', names.includes('Publish as challenge course') && names.includes('Play the official course'), names.join(' | '));
  await page.screenshot({ path: `${out}/end-card.png` });
  await page.click('#publish-challenge');
  await page.waitForSelector('#copy-challenge', { timeout: 30000 });
  ok('publishing sent the course and the keys, and no time', posts.length === 1 && typeof posts[0].made === 'string' && typeof posts[0].keys === 'string' && !('ticks' in posts[0]), Object.keys(posts[0] ?? {}).join(','));
  ok('the card says how it is shared and that it can expire', /Send the link to a friend.*about 14 days/.test(await page.textContent('#challenge-say') ?? ''));
  await page.click('#copy-challenge');
  await page.waitForFunction(() => /Link copied/.test(document.getElementById('challenge-result')?.textContent ?? ''), null, { timeout: 30000 }).catch(() => {});
  const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  ok('the copied link names the challenge course', clip.includes(`cid=${ID}`), clip.slice(0, 80));
  await page.screenshot({ path: `${out}/published.png` });
}
ok('no page errors (run)', page.errs.length === 0, page.errs.join(' | ').slice(0, 300));
// Community on the Courses screen
const home = await open(`http://localhost:${port}/?welcome=0&tour=0`, []);
await home.waitForSelector('#courses-btn', { timeout: 150000 });
await home.click('#courses-btn'); await home.waitForTimeout(1500);
const sec = await home.evaluate(() => [...document.querySelectorAll('h2,h3,h4,summary,legend,div')].some((e) => e.children.length === 0 && /^Community$/.test((e.textContent ?? '').trim())));
const card = await home.evaluate(() => /Tall Wall Remix/.test(document.body.textContent ?? ''));
ok('the Courses screen has a Community section with the course', sec && card, `section ${sec} card ${card}`);
await home.screenshot({ path: `${out}/community.png` });
// the switch
const offPosts = [];
const off = await open(`http://localhost:${port}/?welcome=0&tour=0&challenge=0`, offPosts);
await off.waitForSelector('#courses-btn', { timeout: 150000 });
await off.click('#courses-btn'); await off.waitForTimeout(1500);
ok('?challenge=0 hides the Community section', !(await off.evaluate(() => /Tall Wall Remix/.test(document.body.textContent ?? ''))));
const off2 = await open(`${link}&welcome=0&tour=0&autoplay=1&challenge=0`, []);
await off2.waitForSelector('#report-actions, #report-again', { timeout: 280000 }).catch(() => {});
ok('?challenge=0 hides the challenge strip', !(await off2.$('#report-challenge')));
await b.close(); vite.kill(); process.exit(results.every(Boolean) ? 0 : 1);
