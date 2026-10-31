// CC-108: "Your best" and the board follow a faster run without a reload. Run 1 = 35.2 s is published, run 2 = 35.0 s is cleared and then published; the API is answered by this script.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5303', out = process.argv[2] ?? 'test-results/board-best';
mkdirSync(out, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const COURSE = '/assets/demo/training.course.json', T1 = 4224, T2 = 4200; // 35.2 s and 35.0 s at 120 ticks a second
const fail = (m) => { console.log('FAIL', m); process.exitCode = 1; };
try {
  await new Promise((r) => setTimeout(r, 5000));
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message.slice(0, 120)));
  let mine = null; // what the fake server holds for this player
  await page.route('**/api/leaderboard**', (route) => {
    if (new URL(route.request().url()).searchParams.get('recent')) return route.fulfill({ json: { run: null } });
    const top = mine ? [{ id: 1, nick: 'ThePro', ticks: mine }] : [];
    return route.fulfill({ json: { top, players: top.length, mine: mine ? { rank: 1, ticks: mine } : null, resetAt: null, previous: null } });
  });
  await page.goto(`http://localhost:${port}/?course=${COURSE}&welcome=0&nav=0`);
  await page.waitForSelector('#board-corner', { timeout: 120000 });
  const best = () => page.evaluate(() => document.querySelector('#board-corner #report-best')?.textContent ?? '');
  const row = () => page.evaluate(() => document.querySelector('#board-corner .board-row')?.textContent ?? '');
  const hash = await page.evaluate(async (c) => (await import('/src/sim/replay.ts')).courseHash(await (await fetch(c)).json()), COURSE);
  const clearRun = (ticks) => page.evaluate(async ([h, t]) => { const m = await import('/src/ui/leaderboard.ts'); m.rememberBest('demo/training', h, t); m.announceBest(); }, [hash, ticks]);
  const publish = (ticks) => page.evaluate(async (t) => { const m = await import('/src/ui/leaderboard.ts'); document.dispatchEvent(new CustomEvent(m.PUBLISHED_EVENT, { detail: { nick: 'ThePro', ticks: t, rank: 1, players: 1 } })); }, ticks);
  // run 1: cleared, then published
  await clearRun(T1); await page.waitForFunction(() => /35\.2/.test(document.querySelector('#board-corner #report-best')?.textContent ?? ''), null, { timeout: 5000 }).catch(() => fail(`run 1 best: ${'"'}${'"'}`));
  mine = T1; await publish(T1);
  await page.waitForFunction(() => /ThePro/.test(document.querySelector('#board-corner .board-row')?.textContent ?? ''), null, { timeout: 5000 }).catch(() => fail('run 1 row'));
  // run 2: faster, cleared only (not yet published): Your best moves at once
  await clearRun(T2);
  await page.waitForFunction(() => /35\.0/.test(document.querySelector('#board-corner #report-best')?.textContent ?? ''), null, { timeout: 5000 }).catch(async () => fail(`cleared run 2, best still: ${await best()}`));
  // then published: the row, the place and the best all say 35.0
  mine = T2; await publish(T2);
  await page.waitForFunction(() => /35\.0/.test(document.querySelector('#board-corner .board-row')?.textContent ?? ''), null, { timeout: 5000 }).catch(async () => fail(`row after publish: ${await row()}`));
  if (/35\.2/.test(await best()) || /35\.2/.test(await row())) fail('35.2 still shown');
  const name = await page.evaluate(() => { const n = document.querySelector('#board-corner .board-row span:nth-of-type(2)'); return n ? [n.textContent, n.scrollWidth <= n.clientWidth] : null; });
  if (!name || name[0] !== 'ThePro (you)' && name[0] !== 'ThePro' || !name[1]) fail(`name truncated: ${JSON.stringify(name)}`);
  const at = await page.evaluate(() => Object.fromEntries(['#keys', '#board-corner'].map((s) => { const b = document.querySelector(s)?.getBoundingClientRect(); return [s, b ? [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)] : null]; })));
  if (at['#board-corner'][1] < at['#keys'][1] + at['#keys'][3]) fail(`board overlaps Controls: ${JSON.stringify(at)}`);
  if (at['#board-corner'][0] + at['#board-corner'][2] > 330) fail('board reaches into the course');
  console.log(JSON.stringify(at), JSON.stringify(errors));
  await page.screenshot({ path: `${out}/board-left.png` });
  await browser.close();
} finally { server.kill(); }
