// CC-108: Publish to Leaderboard, the news line, View Run and Race Ghost, with the API answered by the script. Pictures go to the folder given.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5302', out = process.argv[2] ?? 'test-results/board-publish';
mkdirSync(out, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const base = `http://localhost:${port}`, COURSE = '/assets/demo/lache.course.json';
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
    if (u.pathname.endsWith('leaderboard-run')) return route.fulfill({ json: { nick: 'ACE', ticks: made.ticks, keys: made.keys, course: 'demo/lache', hash: made.hash } });
    if (u.searchParams.get('recent')) return route.fulfill({ json: { run: { course: 'demo/lache', nick: 'ACE', ticks: made.ticks, ts: '2026-10-31 10:00:00' } } });
    return route.fulfill({ json: { top: [{ id: 1, nick: 'ACE', ticks: made.ticks }, { id: 2, nick: 'BOB', ticks: made.ticks + 60 }], players: 2, mine: null, resetAt: null, previous: null } });
  });
  await page.route('**/api/course-clear', async (route) => {
    const b = JSON.parse(route.request().postData() ?? '{}'); posts.push(b);
    return route.fulfill({ json: b.publish ? { ok: true, published: true, rank: 2, players: 3, nick: b.nick } : { ok: true } });
  });
  // 2. the news line and View Run + Race Ghost
  await page.goto(`${base}/?course=${COURSE}&welcome=0&nav=0`);
  await page.waitForSelector('#board-news', { state: 'visible', timeout: 120000 });
  const news = await page.textContent('#board-news'); if (!/ACE just set .* on Lache/.test(news ?? '')) fail(`news: ${news}`);
  await page.waitForSelector('#board-corner .board-view', { timeout: 30000 });
  await page.click('#board-corner .board-view');
  await page.waitForSelector('#run-view svg', { timeout: 60000 });
  await page.screenshot({ path: `${out}/view-run.png` });
  await page.click('#run-view-race');
  if (await page.$('#run-view')) fail('the panel stayed open after Race Ghost');
  // 3. a cleared run (the friend's keys played as if by hand) offers Publish, and only a click sends the name
  await page.goto(`${base}/?course=${COURSE}&welcome=0&nav=0&challenge=${made.param}&autoplay=1`);
  await page.waitForSelector('#publish-board', { timeout: 280000 });
  if (posts.some((p) => p.publish)) fail('published before the click');
  if (posts.some((p) => p.nick)) fail('a name was sent before the click');
  await page.fill('#publish-nick', 'Zed');
  await page.click('#publish-board');
  await page.waitForFunction(() => /Published as Zed, #2 of 3/.test(document.getElementById('publish-result')?.textContent ?? ''), null, { timeout: 20000 }).catch(() => fail(`result: ${errors}`));
  await page.screenshot({ path: `${out}/publish.png` });
  if (!posts.some((p) => p.publish && p.nick === 'Zed')) fail('no publish post with the name');
  console.log('posts', JSON.stringify(posts.map((p) => ({ publish: !!p.publish, nick: p.nick ?? null }))), JSON.stringify(errors));
  await browser.close();
} finally { server.kill(); }
