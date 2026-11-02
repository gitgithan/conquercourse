// CC-108: (on the Training Course, a listed board course) Publish to Leaderboard, the news line, View Run and Chase Ghost, with the API answered by the script. Pictures go to the folder given.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5302', out = process.argv[2] ?? 'test-results/board-publish';
mkdirSync(out, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const base = `http://localhost:${port}`, COURSE = '/assets/demo/training.course.json';
const fail = (m) => { console.log('FAIL', m); process.exitCode = 1; };
try {
  await new Promise((r) => setTimeout(r, 5000));
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message.slice(0, 120)));
  // 1. make the keys of the stored plan in the page's own module world
  await page.goto(`${base}/?course=${COURSE}&welcome=0&nav=0`);
  await page.waitForSelector('#board-corner', { timeout: 120000 });
  const made = await page.evaluate(async (c) => {
    const r = await import('/src/sim/replay.ts');
    const course = await (await fetch(c)).json();
    const log = r.recordPlan(course, course.plan, 120 * 120).recorder.snapshot();
    return { keys: await r.encodeLog(log), param: await r.makeChallengeParam(course, log, 'FRIEND'), hash: r.courseHash(course), ticks: log.reduce((a, [, n]) => a + n, 0) };
  }, COURSE);
  const posts = [];
  await page.route('**/api/leaderboard**', async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname.endsWith('leaderboard-run')) return route.fulfill({ json: { nick: 'ACE', ticks: made.ticks, keys: made.keys, course: 'demo/training', hash: made.hash } });
    if (u.searchParams.get('recent')) return route.fulfill({ json: { run: { course: 'demo/training', nick: 'ACE', ticks: made.ticks, ts: '2026-10-31 10:00:00' } } });
    const top = [{ id: 1, nick: 'ACE', ticks: made.ticks }, { id: 2, nick: 'BOB', ticks: made.ticks + 60 }];
    if (posts.some((p) => p.publish)) { top.splice(1, 0, { id: 3, nick: posts.find((p) => p.publish).nick, ticks: made.ticks + 30 }); return route.fulfill({ json: { top, players: 3, mine: { rank: 2, ticks: made.ticks + 30 }, resetAt: null, previous: null } }); }
    return route.fulfill({ json: { top, players: 2, mine: null, resetAt: null, previous: null } });
  });
  // since CC-219 a challenge is a short link (?c=<ten characters>) kept by the share server; this script answers that server itself
  const SHORT = 'abcdefghjk';
  await page.route('**/api/share/**', (route) => route.fulfill({ json: { param: made.param, query: new URLSearchParams({ course: COURSE }).toString(), look: 'a' } }));
  await page.route('**/api/course-clear', async (route) => {
    const b = JSON.parse(route.request().postData() ?? '{}'); posts.push(b);
    return route.fulfill({ json: b.publish ? { ok: true, published: true, rank: 2, players: 3, nick: b.nick } : { ok: true } });
  });
  // 2. the news line and View Run + Race Ghost
  await page.goto(`${base}/?course=${COURSE}&welcome=0&nav=0`);
  await page.waitForSelector('#board-news', { state: 'visible', timeout: 120000 });
  const news = await page.textContent('#board-news'); if (!/ACE just set .* on Training/.test(news ?? '')) fail(`news: ${news}`);
  if ((await page.getAttribute('#board-toggle', 'aria-expanded')) !== 'true') await page.click('#board-toggle'); // the board starts folded to a pill on a 720 px screen
  await page.waitForSelector('#board-corner .board-view', { timeout: 30000 });
  await page.click('#board-corner .board-view');
  await page.waitForSelector('#run-view svg', { timeout: 60000 });
  await page.screenshot({ path: `${out}/view-run.png`, timeout: 120000 });
  await page.click('#run-view-race');
  if (await page.$('#run-view')) fail('the panel stayed open after Chase Ghost');
  // 3. a cleared run (the friend's keys played as if by hand) offers Publish, and only a click sends the name
  await page.goto(`${base}/?c=${SHORT}&welcome=0&nav=0&autoplay=1`);
  await page.waitForSelector('#publish-board', { timeout: 280000 });
  if (posts.some((p) => p.publish)) fail('published before the click');
  if (posts.some((p) => p.nick)) fail('a name was sent before the click');
  if (await page.locator('#share-nick').count()) fail('a second name box is still in the share row');
  await page.screenshot({ path: `${out}/publish-before.png`, timeout: 120000 });
  await page.fill('#publish-nick', 'zEd!9');
  await page.click('#publish-board');
  await page.waitForFunction(() => /Published ✓ as zEd!9, #2 of 3/.test(document.getElementById('publish-board')?.textContent ?? ''), null, { timeout: 20000 }).catch(() => fail(`button: ${errors}`));
  if (!(await page.$eval('#publish-board', (b) => b.disabled))) fail('the Published button can be clicked again');
  await page.waitForFunction(() => [...document.querySelectorAll('#report-board .board-row')].some((r) => /zEd!9 \(you\)/.test(r.textContent ?? '')), null, { timeout: 5000 }).catch(() => fail('the board did not show the new row'));
  const y = await page.evaluate(() => ({ strip: document.getElementById('report-publish').getBoundingClientRect().top, board: document.getElementById('report-board').getBoundingClientRect().top, h2: document.querySelector('section[aria-label="Run report"] h2').getBoundingClientRect().bottom }));
  if (!(y.strip >= y.h2 - 1 && y.strip < y.board)) fail(`the strip is not between the result and the board ${JSON.stringify(y)}`);
  await page.screenshot({ path: `${out}/publish.png`, timeout: 120000 });
  if (!posts.some((p) => p.publish && p.nick === 'zEd!9')) fail('no publish post with the name');
  console.log('posts', JSON.stringify(posts.map((p) => ({ publish: !!p.publish, nick: p.nick ?? null }))), JSON.stringify(errors));
  await browser.close();
} finally { server.kill(); }
