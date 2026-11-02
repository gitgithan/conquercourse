// CC-108: the board of each listed course shows the top 100 times; a row opens to its stats, has Chase Ghost and View Run; the Courses cards link to the boards.
// The API is answered by this script with a seeded board of 100 runs (the keys are the Cannonballs stored plan), so nothing leaves the machine.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5303', out = process.argv[2] ?? 'test-results/board-top100';
mkdirSync(out, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const base = `http://localhost:${port}`, COURSE = '/assets/demo/cannonballs.course.json';
const fail = (m) => { console.log('FAIL', m); process.exitCode = 1; };
try {
  await new Promise((r) => setTimeout(r, 5000));
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message.slice(0, 120)));
  await page.goto(`${base}/?course=${COURSE}&welcome=0&nav=0`);
  await page.waitForSelector('#board-corner', { timeout: 120000 });
  const made = await page.evaluate(async (c) => {
    const r = await import('/src/sim/replay.ts');
    const course = await (await fetch(c)).json();
    const log = r.recordPlan(course, course.plan, 120 * 120).recorder.snapshot();
    return { keys: await r.encodeLog(log), hash: r.courseHash(course), ticks: log.reduce((a, [, n]) => a + n, 0) };
  }, COURSE);
  const asked = [];
  await page.route('**/api/leaderboard**', async (route) => {
    const u = new URL(route.request().url());
    asked.push(u.pathname + u.search);
    if (u.pathname.endsWith('leaderboard-run')) return route.fulfill({ json: { nick: 'ROW3', ticks: made.ticks, keys: made.keys, course: 'demo/cannonballs', hash: made.hash } });
    if (u.searchParams.get('recent')) return route.fulfill({ json: { run: null } });
    const top = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, nick: `NINJA${i + 1}`, ticks: made.ticks + i * 12, ts: `2026-10-${String(1 + (i % 30)).padStart(2, '0')} 09:30:00` }));
    return route.fulfill({ json: { top, players: 100, mine: null, resetAt: null, previous: null } });
  });
  await page.goto(`${base}/?course=${COURSE}&welcome=0&nav=0`);
  await page.waitForSelector('#board-corner .board-row', { state: 'attached', timeout: 120000 });
  if ((await page.getAttribute('#board-toggle', 'aria-expanded')) !== 'true') await page.click('#board-toggle'); // the board starts folded to a pill when the screen is short (720 px)
  await page.click('#board-corner [data-win=all]');
  await page.waitForTimeout(500);
  const rows = await page.locator('#board-corner .board-row').count();
  if (rows !== 100) fail(`rows ${rows}, wanted 100`);
  if (await page.locator('#board-corner .board-chase').count() !== 100) fail('not every row has Chase Ghost');
  if (await page.locator('#board-corner .board-view').count() !== 100) fail('not every row has View Run');
  if (await page.locator('#board-corner .board-chase', { hasText: 'Race Ghost' }).count()) fail('Race Ghost is still there');
  // a row opens to its stats
  await page.click('#board-corner .board-row[data-rank="3"] .board-open');
  await page.waitForFunction(() => /moves/.test(document.querySelector('#board-corner .board-row[data-rank="3"] .board-detail')?.textContent ?? ''), null, { timeout: 60000 }).catch(() => fail('the stats did not show the moves'));
  const detail = await page.textContent('#board-corner .board-row[data-rank="3"] .board-detail');
  if (!/Time .* · Rank #3 · Date 2026-10-03 · Tag NINJA3 · \d+ moves/.test(detail ?? '')) fail(`detail: ${detail}`);
  await page.screenshot({ path: `${out}/board-row-open.png` });
  // Chase Ghost starts the race without a panel; View Run opens the panel
  asked.length = 0;
  await page.click('#board-corner .board-row[data-rank="3"] .board-chase');
  await page.waitForTimeout(3000);
  if (!asked.some((a) => a.includes('leaderboard-run?id=3'))) fail('Chase Ghost did not fetch the run');
  if (await page.$('#run-view')) fail('Chase Ghost opened the panel');
  await page.click('#board-corner .board-row[data-rank="4"] .board-view');
  await page.waitForSelector('#run-view svg', { timeout: 60000 });
  if (!(await page.textContent('#run-view-race'))?.includes('Chase Ghost')) fail('the panel button is not Chase Ghost');
  await page.click('#run-view-close');
  // the Courses cards link to the boards
  await page.keyboard.press('Escape');
  await page.goto(`${base}/?mode=course&welcome=0`);
  await page.waitForSelector('#sitenav', { timeout: 60000 });
  await page.click('#sitenav [data-feature=courses]');
  await page.waitForSelector('.wg-card', { timeout: 30000 });
  const links = await page.locator('.wg-card .wg-board').evaluateAll((els) => els.map((e) => e.closest('.wg-card').dataset.value));
  if (JSON.stringify(links) !== JSON.stringify(['', '/assets/demo/training.course.json', '/assets/demo/cannonballs.course.json', '/assets/demo/two-ways.course.json'])) fail(`leaderboard links: ${JSON.stringify(links)}`);
  await page.screenshot({ path: `${out}/courses-cards.png` });
  console.log('rows', rows, 'links', links.length, JSON.stringify(errors));
  await browser.close();
} finally { server.kill(); }
