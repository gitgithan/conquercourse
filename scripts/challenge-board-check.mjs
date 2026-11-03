// Browser check (CC-133 docs truth): does a Course opened from a challenge link (?cid=<id>) show a board and ask the server for that course's board?
// The server is replaced by route mocks; the page is the real built source. Run: PORT=5391 node scripts/challenge-board-check.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const port = process.env.PORT ?? '5391', id = 'abcdefghjk';
const course = JSON.parse(readFileSync('public/assets/demo/cannonballs.course.json', 'utf8'));
for (const k of ['scene', 'source', 'uMap', 'plan', 'routes', 'windows', 'shortcuts', 'designedShortcuts', 'off']) delete course[k]; // the server keeps a challenge course without its looks (LOOKS_ONLY in src/course/schema.ts)
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(() => { try { localStorage.setItem('cc.worldWelcome.seen', '1'); } catch {} });
const page = await ctx.newPage();
const seen = [];
await page.route('**/api/**', (r) => {
  const u = new URL(r.request().url());
  seen.push(`${r.request().method()} ${u.pathname}${u.search}`);
  if (u.pathname === '/api/challenge-course') return r.fulfill({ json: { course } });
  if (u.pathname === '/api/leaderboard') return r.fulfill({ json: { rows: [{ rank: 1, nick: 'ANNA', ticks: 900, id: 7, at: Date.now(), you: false }], players: 1, mine: null, total: 1, window: 'day', top: [], recent: [] } });
  return r.fulfill({ json: {} });
});
const errors = []; page.on('pageerror', (e) => errors.push(e.message.slice(0, 120)));
await page.goto(`http://localhost:${port}/?cid=${id}`);
await page.waitForTimeout(9000);
const board = await page.evaluate(() => [...document.querySelectorAll('[id*="board" i],[class*="board" i]')].map((e) => `${e.tagName}#${e.id}.${e.className} :: ${e.textContent.trim().slice(0, 80)}`).slice(0, 6));
console.log('dataset', await page.evaluate(() => JSON.stringify({...document.documentElement.dataset})));
await page.screenshot({ path: 'test-results/challenge-board.png' });
console.log(JSON.stringify({ requests: [...new Set(seen)], boardElements: board, pageErrors: errors }, null, 2));
await browser.close();
