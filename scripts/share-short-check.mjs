// CC-219: the short link end to end on the built site with local Pages functions and a LOCAL database (wrangler's own sqlite; the live database is never touched).
// Needs `npm run build` first. One browser at a time. Usage: node scripts/share-short-check.mjs [outdir]
import { chromium } from 'playwright';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'test-results/share-short'; mkdirSync(out, { recursive: true });
const port = Number(process.env.PORT ?? 8789);
const course = 'public/assets/demo/lache.course.json';
const results = []; const ok = (n, p, note = '') => { results.push(p); console.log(p ? 'PASS' : 'FAIL', n, note); };
execFileSync('npx', ['wrangler', 'd1', 'execute', 'conquercourse-feedback', '--local', '--file', 'migrations/0006_shares.sql'], { stdio: 'ignore' });
const sql = (q) => execFileSync('npx', ['wrangler', 'd1', 'execute', 'conquercourse-feedback', '--local', '--command', q, '--json'], { encoding: 'utf8' });
const server = spawn('npx', ['wrangler', 'pages', 'dev', 'dist', '--port', String(port), '--d1=DB=153f511c-2d03-4442-b7cb-9f988a84becd'], { stdio: 'ignore' });
try {
  for (let i = 0; i < 90; i++) { try { if ((await fetch(`http://localhost:${port}/`)).ok) break; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 1000)); }
  const origin = `http://localhost:${port}`;
  const longLink = execFileSync('node_modules/.bin/tsx', ['scripts/share-link.ts', course, origin]).toString().trim();
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${longLink}&autoplay=1&welcome=0&tour=0`, { waitUntil: 'load' });
  const banner = await page.waitForSelector('#challenge-banner', { timeout: 120000 }).then((e) => e.innerText()).catch(() => '');
  const seconds = banner.match(/(\d+\.\d\d) s/)?.[1];
  ok('the old long link still opens', !!seconds, banner.replace(/\n/g, ' | '));
  const got = await page.waitForSelector('#report-again', { timeout: 300000 }).then(() => true).catch(() => false);
  ok('the friend run ends in the report', got);
  await page.click('#share-copy');
  await page.waitForFunction(() => /copied|ready/i.test(document.querySelector('#share-copy').textContent), null, { timeout: 20000 }).catch(() => {});
  const copied = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  ok('the copied link is short: ?c= and ten characters', new RegExp(`^${origin}/\\?c=[a-z2-9]{10}$`).test(copied), copied);
  await page.screenshot({ path: `${out}/report-copied.png` });
  const row = JSON.parse(sql('SELECT id, kind, course_kind, course_key, length(keys) AS keys_len, nick FROM shares'));
  ok('one row in the local database for it', row[0]?.results?.length === 1 && row[0].results[0].course_key === 'demo/lache', JSON.stringify(row[0]?.results));
  await page.click('#share-copy'); await page.waitForTimeout(1500);
  ok('the same run shared again keeps one row', JSON.parse(sql('SELECT COUNT(*) AS n FROM shares'))[0].results[0].n === 1);
  const again = await ctx.newPage(); const e2 = []; again.on('pageerror', (e) => e2.push(String(e)));
  await again.goto(`${copied}&welcome=0&tour=0`, { waitUntil: 'load' });
  const b2 = await again.waitForSelector('#challenge-banner', { timeout: 120000 }).then((e) => e.innerText()).catch(() => '');
  ok('the short link opens with the same time to beat', b2.includes(`${seconds} s`), b2.replace(/\n/g, ' | '));
  ok('the address now holds the long form the page reads', /challenge=1\./.test(again.url()) && !/[?&]c=/.test(again.url()));
  await again.screenshot({ path: `${out}/short-opened.png` });
  const bad = await ctx.newPage();
  await bad.goto(`${origin}/?c=zzzzzzzzzz&welcome=0&tour=0`, { waitUntil: 'load' });
  const tb = await bad.waitForSelector('#challenge-banner', { timeout: 60000 }).then((e) => e.innerText()).catch(() => '');
  ok('an unknown id is refused in plain words', /damaged/.test(tb), tb.replace(/\n/g, ' | '));
  await bad.screenshot({ path: `${out}/unknown.png` });
  // the server down: the button falls back to the long link
  const down = await ctx.newPage(); await down.route('**/api/share', (r) => r.abort());
  await down.goto(`${longLink}&autoplay=1&welcome=0&tour=0`, { waitUntil: 'load' });
  await down.waitForSelector('#report-again', { timeout: 300000 });
  await down.click('#share-copy');
  await down.waitForFunction(() => /copied|ready/i.test(document.querySelector('#share-copy').textContent), null, { timeout: 20000 }).catch(() => {});
  const fallback = await down.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  ok('with the server unreachable the copied link is the long one', /\?course=[^&]+&challenge=1\./.test(fallback), fallback.slice(0, 100));
  ok('no page errors', errs.length + e2.length === 0, [...errs, ...e2].join(' | ').slice(0, 300));
  await b.close();
} finally { server.kill(); try { execFileSync('npx', ['wrangler', 'd1', 'execute', 'conquercourse-feedback', '--local', '--command', 'DROP TABLE IF EXISTS shares'], { stdio: 'ignore' }); } catch { /* ok */ } }
process.exit(results.every(Boolean) ? 0 : 1);
