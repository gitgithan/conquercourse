// CC-133 checks 1, 2, 7 (courses/leaderboard): node scripts/prod-test-1-course.mjs <base> <outdir>
import { start, newPage } from './prod-test-lib.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const [base, out] = [process.argv[2], process.argv[3]]; mkdirSync(out, { recursive: true });
const log = {}, res = {}; const b = await start();
const tag = base.includes('preview') ? 'preview' : 'prod';
async function step(name, fn) { try { res[name] = await fn(); } catch (e) { res[name] = 'ERROR ' + e.message.slice(0, 200); } console.log(name, JSON.stringify(res[name])); }
// home
await step('home', async () => { const { page } = await newPage(b, log, 'home'); await page.goto(base + '/?welcome=0'); await page.waitForSelector('html[data-ready=true]'); await page.waitForTimeout(1500);
  const r = { title: await page.title(), buttons: (await page.$$eval('button', (e) => e.map((x) => x.textContent.trim()).filter(Boolean))).slice(0, 12) }; await page.screenshot({ path: `${out}/${tag}-home.png` }); await page.close(); return r; });
// training run with bot
await step('training-run', async () => { const { page } = await newPage(b, log, 'training'); const t0 = Date.now();
  await page.goto(base + '/?course=/assets/demo/training.course.json&bot=ideal&welcome=0&music=1'); await page.waitForSelector('html[data-ready=true]');
  const probe = () => page.evaluate(() => { const e = [...document.querySelectorAll('*')].find((x) => x.children.length === 0 && /Fastest runs/.test(x.textContent)); if (!e) return null; const bx = e.getBoundingClientRect(); const top = document.elementFromPoint(bx.x + 5, bx.y + 5); return { x: Math.round(bx.x), y: Math.round(bx.y), w: Math.round(bx.width), h: Math.round(bx.height), onTop: !!top && (top === e || e.contains(top) || top.contains(e)), display: getComputedStyle(e).display }; });
  await page.waitForTimeout(4000); const mid = await probe();
  const end = await page.waitForSelector('#report-again', { timeout: 300000 }).then(() => true).catch(() => false);
  await page.waitForTimeout(800);
  const atEnd = await probe();
  const r = { endScreen: end, secs: Math.round((Date.now() - t0) / 1000), fastestCardMidRun: mid, fastestCardAtEnd: atEnd };
  r.cardTopRightMidRun = !!mid && mid.x > 640 && mid.y < 360; r.cardVisibleAtEnd = !!atEnd && atEnd.onTop;
  r.reportText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 300);
  r.leaderboardCalls = Object.entries(log.training.api).filter(([k]) => /leaderboard|submit|course-/.test(k));
  await page.screenshot({ path: `${out}/${tag}-end.png` }); await page.close(); return r; });
// volume
await step('volume', async () => { const { page } = await newPage(b, log, 'volume'); await page.goto(base + '/?course=/assets/demo/training.course.json&welcome=0&music=1'); await page.waitForSelector('html[data-ready=true]'); await page.waitForTimeout(1500);
  const ids = await page.evaluate(() => [...document.querySelectorAll('button')].map((x) => `${x.id}|${x.getAttribute('aria-label')}|${x.getAttribute('aria-pressed')}|${Math.round(x.getBoundingClientRect().x)},${Math.round(x.getBoundingClientRect().y)}|${x.textContent.trim().slice(0, 12)}`));
  const sel = '#music-button', has = await page.$(sel); const r = { buttons: ids.filter((s) => /music|sound|feedback/i.test(s)) };
  if (has) { const s0 = await has.getAttribute('aria-label'), p0 = await has.getAttribute('aria-pressed'); await has.click(); const s1 = await has.getAttribute('aria-label'), p1 = await has.getAttribute('aria-pressed');
    await page.keyboard.press('KeyM'); await page.waitForTimeout(200); const s2 = await has.getAttribute('aria-label'); r.click = { s0, p0, s1, p1 }; r.mKeyRestores = s2 === s0; r.toggledByClick = s0 !== s1 && p0 !== p1; }
  await page.screenshot({ path: `${out}/${tag}-volume.png`, clip: { x: 0, y: 560, width: 1280, height: 160 } }); await page.close(); return r; });
// music
await step('music', async () => { const { page, ctx } = await newPage(b, log, 'music'); const files = [];
  page.on('response', (r) => { if (r.url().includes('/assets/music/')) files.push(r.url().split('/').pop() + ':' + r.status()); });
  await page.addInitScript(() => { try { localStorage.setItem('cc.music', '0'); } catch {} });
  await page.goto(base + '/?music=1'); await page.waitForSelector('html[data-ready=true]'); await page.waitForTimeout(1500);
  const wiped = await page.evaluate(() => localStorage.getItem('cc.music')); const before = await page.evaluate(() => document.documentElement.dataset.musicPath ?? 'none');
  await page.mouse.click(600, 400); await page.waitForTimeout(1500);
  const r = { files, storedMusicAfterLoad: wiped, pathBeforeClick: before, pathAfterClick: await page.evaluate(() => document.documentElement.dataset.musicPath ?? 'none'), dataMusic: await page.evaluate(() => document.documentElement.dataset.music ?? 'none') };
  await page.close(); return r; });
// Courses overlay (the Courses button; there is no ?mode=courses), pick Training, Fastest runs card, leaderboard read
await step('courses-overlay', async () => { const { page } = await newPage(b, log, 'courses'); const lb = [];
  page.on('request', (q) => { if (q.url().includes('/api/leaderboard')) lb.push(q.url().replace(base, '')); });
  await page.goto(base + '/?welcome=0'); await page.waitForSelector('html[data-ready=true]');
  await page.getByRole('button', { name: 'Courses', exact: true }).first().click(); await page.waitForTimeout(1500);
  const cards = await page.evaluate(() => [...document.querySelectorAll('h3,h2,b,strong')].map((x) => x.textContent.trim()).filter((t) => /course|ways|Cannon|basics/i.test(t)).slice(0, 10));
  await page.screenshot({ path: `${out}/${tag}-courses.png` });
  await page.getByText('Training course: every move').first().click(); await page.waitForTimeout(3000);
  const r = { cards, urlAfterPick: page.url().replace(base, ''), fastestRunsVisible: await page.evaluate(() => /Fastest runs/.test(document.body.innerText)), leaderboardRequests: lb.slice(0, 4) };
  const first = lb.find((u) => /course=/.test(u)); if (first) { const x = await fetch(base + first); r.leaderboardRead = { status: x.status, body: (await x.text()).slice(0, 300) }; }
  await page.close(); return r; });
writeFileSync(`${out}/${tag}-1-course.json`, JSON.stringify({ res, log }, null, 2)); await b.close();
