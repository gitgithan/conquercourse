// CC-100: the first-visit tour, the Help chip and the What next card, in a real browser on a fresh profile.
// Checks: the tour appears, finishes by Next, finishes by itself in 30 s or less, Skip and Esc work at every step,
// returning players are left alone, a cleared run shows the What next card once, and no card covers another control.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5499';
const out = process.env.OUT ?? 'data/eval/cc-100-onboarding'; mkdirSync(out, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist', '--no-sandbox'];
const base = `http://localhost:${port}`;
const results = []; const check = (name, ok, extra = '') => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, extra); };
const errors = [];
let browser;
const fresh = async (w = 1280, h = 720) => { // a new context is a new profile (empty storage); the init script makes the page look like a person's browser, not automation
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }); });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errors.push(e.message)); return { ctx, page };
};
const ready = (page) => page.waitForSelector('html[data-ready=true]', { timeout: 120000 });
const stepIndex = (page) => page.evaluate(() => [...document.querySelectorAll('#tour .dots i')].findIndex((i) => i.classList.contains('on')));
const tourOpen = (page) => page.evaluate(() => !!document.getElementById('tour'));
const goNext = async (page, n) => { for (let i = 0; i < n; i++) { const from = await stepIndex(page); await page.click('#tour-next'); await page.waitForFunction((f) => { const d = [...document.querySelectorAll('#tour .dots i')]; return !d.length || d.findIndex((x) => x.classList.contains('on')) !== f; }, from, { timeout: 5000 }); } };
// the onboarding cards against every other visible fixed control (full-width layers such as the message line and the pause backdrop are skipped)
const overlaps = (page) => page.evaluate(() => {
  const mine = ['tour', 'chelp', 'helpmenu', 'ccfirstfall'].map((id) => document.getElementById(id)).filter(Boolean);
  const vw = innerWidth, bad = [];
  const rect = (e) => e.getBoundingClientRect();
  const hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  for (const e of document.querySelectorAll('body *')) {
    if (mine.includes(e) || mine.some((m) => m.contains(e) || e.contains(m))) continue;
    const cs = getComputedStyle(e); if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
    const r = rect(e); if (r.width < 20 || r.height < 20 || r.width >= vw * 0.95) continue;
    for (const m of mine) if (hit(rect(m), r)) bad.push(`${m.id} over ${e.id || e.className || e.tagName}:${(e.textContent || '').trim().slice(0, 18)}`);
  }
  return bad;
});
try {
  await new Promise((r) => setTimeout(r, 3500));
  browser = await chromium.launch({ args: flags });

  // 1. fresh profile: tour, Next through, Help chip, returning visit
  for (const [w, h] of [[1280, 720], [1024, 640]]) {
    const { ctx, page } = await fresh(w, h); await page.goto(base + '/?tourstep=600'); await ready(page);
    await page.waitForSelector('#tour', { timeout: 10000 });
    check(`${w}x${h}: the tour opens on a first visit, with no world chooser`, (await tourOpen(page)) && !(await page.$('#choose-world')));
    check(`${w}x${h}: the Help chip is there`, !!(await page.$('#chelp')));
    for (let i = 0; i < 6; i++) {
      await page.screenshot({ path: `${out}/tour-${w}x${h}-step${i + 1}.png` });
      const bad = await overlaps(page); check(`${w}x${h}: step ${i + 1} covers no other control`, bad.length === 0, bad.join(' | '));
      if (i < 5) await goNext(page, 1);
    }
    await page.click('#tour-next'); await page.waitForFunction(() => !document.getElementById('tour'), null, { timeout: 5000 });
    check(`${w}x${h}: Let's go closes the tour and remembers it`, await page.evaluate(() => localStorage.getItem('cc.tour.done') === '1'));
    await page.click('#chelp'); await page.waitForSelector('#helpmenu');
    const bad = await overlaps(page); check(`${w}x${h}: the Help menu covers no other control`, bad.length === 0, bad.join(' | '));
    await page.screenshot({ path: `${out}/helpmenu-${w}x${h}.png` });
    await page.click('text=Replay the tour'); await page.waitForSelector('#tour');
    check(`${w}x${h}: Replay the tour opens it again`, (await stepIndex(page)) === 0);
    await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.getElementById('tour'));
    await page.reload(); await ready(page); await page.waitForTimeout(1500);
    check(`${w}x${h}: a returning visit shows no tour`, !(await tourOpen(page)) && !!(await page.$('#chelp')));
    await ctx.close();
  }

  // 2. the tour finishes by itself in 30 s or less
  { const { ctx, page } = await fresh(); await page.goto(base + '/'); await ready(page); await page.waitForSelector('#tour');
    const t0 = Date.now(); await page.waitForFunction(() => !document.getElementById('tour'), null, { timeout: 45000 }); const secs = (Date.now() - t0) / 1000;
    check('the tour ends by itself in 30 s or less', secs <= 30, `${secs.toFixed(1)} s`); await ctx.close(); }

  // 3. Skip at every step, and Esc
  for (let i = 0; i < 6; i++) {
    const { ctx, page } = await fresh(); await page.goto(base + '/?tourstep=600'); await ready(page); await page.waitForSelector('#tour'); await goNext(page, i);
    await page.click('#tour-skip'); await page.waitForFunction(() => !document.getElementById('tour'), null, { timeout: 5000 });
    check(`Skip works at step ${i + 1}`, await page.evaluate(() => localStorage.getItem('cc.tour.done') === '1')); await ctx.close();
  }
  { const { ctx, page } = await fresh(); await page.goto(base + '/?tourstep=600'); await ready(page); await page.waitForSelector('#tour'); await goNext(page, 2);
    await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.getElementById('tour'), null, { timeout: 5000 }); check('Esc skips the tour', true); await ctx.close(); }

  // 4. keys advance their steps and do not start the run
  { const { ctx, page } = await fresh(); await page.goto(base + '/?tourstep=600'); await ready(page); await page.waitForSelector('#tour');
    await page.waitForTimeout(300); await page.keyboard.press('KeyC'); await page.waitForFunction(() => [...document.querySelectorAll('#tour .dots i')].findIndex((i) => i.classList.contains('on')) === 1, null, { timeout: 4000 });
    check('C advances the camera step', true);
    const tick0 = await page.evaluate(() => Number(document.documentElement.dataset.tick ?? 0));
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(900); await page.keyboard.up('ArrowRight');
    await page.waitForFunction(() => [...document.querySelectorAll('#tour .dots i')].findIndex((i) => i.classList.contains('on')) === 2, null, { timeout: 4000 });
    const x1 = await page.evaluate(() => Number(document.documentElement.dataset.x ?? 0));
    check('a move key advances the moves step', true); check('the runner has not run off', x1 === 0 || x1 < 2, `x=${x1} tick0=${tick0}`);
    await ctx.close(); }

  // 5. a cleared run shows the What next card once (the bot plays the last stretch; ?next=1 lets the bot's clear count)
  { const { ctx, page } = await fresh(); const url = `${base}/?bot=ideal&startx=85&next=1&welcome=0`; await page.goto(url); await ready(page);
    await page.waitForSelector('#ccnext', { timeout: 150000 }); check('the What next card shows after a cleared run', true);
    check('the card is in view without scrolling', await page.evaluate(() => { const r = document.getElementById('ccnext').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }));
    await page.screenshot({ path: `${out}/what-next.png` });
    check('the card has the three groups', (await page.$$eval('#ccnext h4', (h) => h.map((x) => x.textContent))).join('|') === 'Your controls|Build|Do and share');
    await page.click('#ccnext >> text=Got it'); check('Got it removes it', !(await page.$('#ccnext')));
    await page.reload(); await ready(page); await page.waitForTimeout(25000); check('it is not shown again', !(await page.$('#ccnext')));
    await ctx.close(); }

  // 6. the switch: ?onboarding=0 shows no tour and no chip; ?welcome=0 is untouched
  { const { ctx, page } = await fresh(); await page.goto(base + '/?onboarding=0'); await ready(page); await page.waitForTimeout(800);
    check('?onboarding=0 shows no tour and no chip', !(await tourOpen(page)) && !(await page.$('#chelp'))); await ctx.close(); }
  { const { ctx, page } = await fresh(); await page.goto(base + '/?welcome=0'); await ready(page); await page.waitForTimeout(800);
    check('?welcome=0 keeps today\'s behaviour (no tour)', !(await tourOpen(page))); await ctx.close(); }
} finally { await browser?.close(); server.kill(); }
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`${results.filter(Boolean).length} of ${results.length} checks pass`);
process.exit(results.every(Boolean) ? 0 : 1);
