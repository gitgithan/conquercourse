// CC-219: when the server asks for a pause, the player is told when to come back and the run is kept. The API is answered by the script.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5303', out = process.argv[2] ?? 'test-results/ratelimit';
mkdirSync(out, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const base = `http://localhost:${port}`, COURSE = '/assets/demo/lache.course.json';
const fail = (m) => { console.log('FAIL', m); process.exitCode = 1; };
try {
  await new Promise((r) => setTimeout(r, 5000));
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.dismiss());
  const errors = []; page.on('pageerror', (e) => errors.push(e.message.slice(0, 120)));
  await page.goto(`${base}/?course=${COURSE}&welcome=0&nav=0`);
  await page.waitForSelector('#board-corner', { timeout: 120000 });
  const made = await page.evaluate(async (c) => {
    const r = await import('/src/sim/replay.ts');
    const course = await (await fetch(c)).json();
    const log = r.recordPlan(course, course.plan, 120 * 120).recorder.snapshot();
    return { param: await r.makeChallengeParam(course, log, 'FRIEND') };
  }, COURSE);
  let publishCalls = 0, shareCalls = 0;
  const slow = (s) => ({ status: 429, headers: { 'retry-after': String(s) }, json: { error: 'slow down', reason: 'slow_down', retryAfterSeconds: s } });
  await page.route('**/api/leaderboard**', (route) => route.fulfill({ json: { top: [], players: 0, mine: null, resetAt: null, previous: null } }));
  await page.route('**/api/course-clear', async (route) => {
    const b = JSON.parse(route.request().postData() ?? '{}');
    if (!b.publish) return route.fulfill({ json: { ok: true } });
    publishCalls++;
    return publishCalls === 1 ? route.fulfill(slow(4)) : route.fulfill({ json: { ok: true, published: true, rank: 1, players: 1, nick: b.nick } });
  });
  await page.route('**/api/share', async (route) => { shareCalls++; return route.fulfill(slow(40)); });
  await page.goto(`${base}/?course=${COURSE}&welcome=0&nav=0&challenge=${made.param}&autoplay=1`);
  await page.waitForSelector('#publish-board', { timeout: 280000 });
  // Publish: told when, counted down, back by itself, and then it goes through
  await page.fill('#publish-nick', 'Zed9');
  await page.click('#publish-board');
  await page.waitForFunction(() => /Publish in \d+ s/.test(document.getElementById('publish-board')?.textContent ?? ''), null, { timeout: 10000 }).catch(() => fail('no countdown on Publish'));
  const said = await page.textContent('#publish-result');
  if (!/Your run is safe: try again in a few seconds/.test(said ?? '')) fail(`publish words: ${said}`);
  if (!(await page.$eval('#publish-board', (b) => b.disabled))) fail('Publish is clickable during the pause');
  if ((await page.inputValue('#publish-nick')) !== 'Zed9') fail('the name box lost the name');
  await page.screenshot({ path: `${out}/publish-wait.png` });
  await page.waitForFunction(() => !document.getElementById('publish-board').disabled && /Publish to Leaderboard/.test(document.getElementById('publish-board').textContent), null, { timeout: 15000 }).catch(() => fail('Publish did not come back by itself'));
  await page.click('#publish-board');
  await page.waitForFunction(() => /Published ✓/.test(document.getElementById('publish-board')?.textContent ?? ''), null, { timeout: 10000 }).catch(() => fail('second try did not publish'));
  // Copy link: a note with the time, a countdown on the button, and no second server call while the pause lasts
  await page.click('#share-copy');
  await page.waitForSelector('#share-wait', { state: 'visible', timeout: 10000 }).catch(async () => fail(`no wait note; shareCalls ${shareCalls}; button: ${await page.textContent('#share-copy')}; note: ${await page.evaluate(() => document.getElementById('share-wait')?.outerHTML)}`));
  const note = await page.textContent('#share-wait');
  if (!/Your run is safe: try again in about 40 seconds\. You can still download a video\./.test(note ?? '')) fail(`share note: ${note}`);
  await page.screenshot({ path: `${out}/share-wait.png` });
  await page.click('#share-copy'); await page.click('#share-copy');
  if (shareCalls !== 1) fail(`the server was asked ${shareCalls} times during the pause`);
  const held = await page.evaluate(() => localStorage.getItem('cc.unshared'));
  if (held) fail('the held run was not released after publishing');
  console.log('publishCalls', publishCalls, 'shareCalls', shareCalls, JSON.stringify(errors));
  await browser.close();
} finally { server.kill(); }
