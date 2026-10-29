// CC-149 browser check: numbers and difficulty order on the course cards, and a cleared run offered to the server.
//   PORT=5931 node scripts/stats-check.mjs      (screenshots in test-results/stats/)
// The server is a stand-in here: the page asks /api/course-stats and the check answers with seeded numbers (or an error, or nothing at all).
// The body the browser sends for a cleared run is handed to the real function on a real SQLite database (scripts/stats-verify-body.ts).
import { chromium } from 'playwright';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const port = Number(process.env.PORT ?? 5931), out = process.env.OUT ?? 'test-results/stats';
mkdirSync(out, { recursive: true });
const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 6000));
const results = []; const ok = (n, p, note = '') => { results.push({ name: n, pass: !!p, note }); console.log(p ? 'PASS' : 'FAIL', n, note); };
const flags = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'];
const b = await chromium.launch({ args: flags });
const SEEDED = { courses: {
  'experiments/osm/montmartre-paris': { plays: 1204, fails: 380, clears: 311, best: 4944, median: 6900 },
  'experiments/osm/eixample-barcelona': { plays: 520, fails: 40, clears: 300, best: 8100, median: 9000 },
  'experiments/osm/circular-quay-sydney': { plays: 610, fails: 260, clears: 90, best: 7300, median: 11800 },
  'experiments/osm/san-francisco-lombard': { plays: 3, fails: 1, clears: 0, best: null, median: null },
  'demo/training': { plays: 2210, fails: 900, clears: 700, best: 4300, median: 6200 },
  'demo/coaster-two-hills': { plays: 90, fails: 5, clears: 0, best: null, median: null },
} };
const open = async (w, h, query, answer) => {
  const page = await b.newPage({ viewport: { width: w, height: h } });
  const asked = []; page.on('request', (r) => { if (r.url().includes('/api/course-stats')) asked.push(r.url()); });
  await page.route('**/api/course-stats', (route) => answer === 'error' ? route.fulfill({ status: 500, body: 'no' }) : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer ?? SEEDED) }));
  await page.addInitScript(() => { try { localStorage.setItem('cc.worldWelcome.seen', '1'); localStorage.setItem('cc.music', '0'); } catch {} });
  await page.goto(`http://localhost:${port}/?course=/assets/demo/training.course.json&welcome=0&tour=0${query}`, { waitUntil: 'load' });
  await page.click('#courses-btn');
  await page.waitForSelector('#world-gallery .wg-card');
  await page.waitForTimeout(1200);
  return { page, asked };
};
const titles = (page, group) => page.evaluate((g) => [...document.querySelectorAll(`#world-gallery section[data-group="${g}"] .wg-card b`)].map((e) => e.firstChild.textContent.trim()), group);
const lines = (page) => page.evaluate(() => [...document.querySelectorAll('#world-gallery .wg-stats')].map((e) => e.innerText.replace(/\n/g, ' ')));

for (const [w, h, tag] of [[1280, 720, 'desktop'], [390, 800, 'phone']]) {
  const { page } = await open(w, h, '');
  const real = await titles(page, 'Real places');
  ok(`${tag}: Real places are ordered by difficulty from the seeded numbers`, real.join('|') === 'Barcelona block|Montmartre, Paris|Sydney quay|San Francisco hill (62 m of hill)', real.join(' | '));
  const l = await lines(page);
  ok(`${tag}: a card says plays, cleared and best time in plain words`, l.some((x) => /1,204 plays, 311 cleared, best 41\.2 s/.test(x)), l.join(' || '));
  ok(`${tag}: a course with only plays says only plays`, l.some((x) => /^3 plays$/.test(x.replace(/[●○]/g, '').trim())), l.join(' || '));
  ok(`${tag}: no word about people anywhere`, !/people|players|person/i.test(l.join(' ')));
  ok(`${tag}: the dots have a word for screen readers`, await page.evaluate(() => [...document.querySelectorAll('.wg-dots')].every((e) => /^Difficulty: (Easy|Medium|Hard|Very hard)$/.test(e.getAttribute('aria-label')))));
  const cut = await page.evaluate(() => [...document.querySelectorAll('#world-gallery .wg-card')].filter((c) => c.scrollWidth > c.clientWidth + 1).length);
  ok(`${tag}: no card text is cut off`, cut === 0, String(cut));
  await page.evaluate(() => document.querySelector('#world-gallery .wg').scrollTo(0, 0));
  await page.screenshot({ path: `${out}/cards-${tag}.png` });
  await page.close();
}
{ // nothing known: the menu order and no numbers
  const { page } = await open(1280, 720, '', { courses: {} });
  ok('no data: menu order, no numbers and no dots', (await titles(page, 'Real places'))[0] === 'Montmartre, Paris' && (await lines(page)).length === 0);
  await page.screenshot({ path: `${out}/cards-no-data.png` }); await page.close();
}
{ const { page } = await open(1280, 720, '', 'error'); ok('server error: menu order, no numbers, no crash', (await titles(page, 'Real places'))[0] === 'Montmartre, Paris' && (await lines(page)).length === 0); await page.close(); }
{ const { page, asked } = await open(1280, 720, '&stats=0'); ok('?stats=0: no request and no numbers', asked.length === 0 && (await lines(page)).length === 0 && (await titles(page, 'Real places'))[0] === 'Montmartre, Paris'); await page.close(); }

// a cleared run is offered to the server, and the real function accepts what the browser sent
const link = execFileSync('node_modules/.bin/tsx', ['scripts/share-link.ts', 'public/assets/demo/park-run.course.json', `http://localhost:${port}`]).toString().trim();
for (const [tag, extra, expectSent] of [['a cleared run', '', true], ['?stats=0', '&stats=0', false]]) {
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const sent = []; await page.route('**/api/course-clear', (route) => { sent.push(route.request().postData()); route.fulfill({ status: 200, body: '{"ok":true}' }); });
  await page.route('**/api/course-event', (route) => route.fulfill({ status: 200, body: '{"ok":true}' }));
  await page.goto(`${link}&autoplay=1&welcome=0&tour=0${extra}`, { waitUntil: 'load' });
  const done = await page.waitForSelector('#report-again', { timeout: 240000 }).then(() => true).catch(() => false);
  await page.waitForTimeout(1500);
  ok(`${tag}: the run ended in the report`, done);
  if (expectSent) {
    ok(`${tag}: the browser offered the run once`, sent.length === 1, String(sent.length));
    if (sent.length) {
      const body = JSON.parse(sent[0]);
      ok(`${tag}: the offer holds keys, the course and its hash, and no name, time or email`, Object.keys(body).sort().join() === 'courseKey,hash,keys,runId,session' && body.courseKey === 'demo/park-run');
      writeFileSync(`${out}/clear-body.json`, sent[0]);
      const r = JSON.parse(execFileSync('node_modules/.bin/tsx', ['scripts/stats-verify-body.ts', `${out}/clear-body.json`]).toString().trim().split('\n').pop());
      ok(`${tag}: the real function played the keys again and kept a clear`, r.status === 200 && r.row?.course_key === 'demo/park-run' && r.row.ticks > 300, JSON.stringify(r));
    }
  } else ok(`${tag}: nothing was offered`, sent.length === 0, String(sent.length));
  await page.close();
}
await b.close(); vite.kill();
writeFileSync(`${out}/run.json`, JSON.stringify({ results }, null, 2) + '\n');
process.exit(results.every((r) => r.pass) ? 0 : 1);
