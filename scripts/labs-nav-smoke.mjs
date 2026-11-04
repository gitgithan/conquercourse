// CC-118 / CC-133: the slim Labs bar on every Lab. Walks all Labs with Next, back with Previous, and checks on each page:
// the bar is 34 px and names the Lab, the Lab starts under the bar (--labs-nav-h), the summary box sits under the bar without overlap,
// the Sound button is in the bar (not floating over a Lab), the panel lists every Lab, no page errors. Shots of the first, middle and last Lab.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const out = process.env.OUT ?? 'test-results/cc-118-labs-nav';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const fail = [], errors = [];
try {
  await new Promise((r) => setTimeout(r, 5000));
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  mkdirSync(out, { recursive: true });
  const base = `http://localhost:${port}/?labs=1&welcome=0&sunat=noon&backend=webgl2`;
  await page.goto(`${base}&mode=lab-search`);
  await page.waitForSelector('#labs-open', { timeout: 90000 });
  const modes = await page.$$eval('#labs-panel a.lp-tile', (as) => as.map((a) => a.dataset.lab));
  // the walking order is the bar's own Next chain, starting at the first Lab
  const order = [];
  const probe = async (mode) => {
    await page.waitForSelector(`#${mode}`, { timeout: 90000 });
    await page.waitForSelector('#labs-nav', { timeout: 10000 });
    await page.waitForTimeout(700);
    return page.evaluate((m) => {
      const nav = document.getElementById('labs-nav'), root = document.getElementById(m), sum = root.querySelector('.lab-summary'), sound = document.getElementById('soundbutton');
      const nb = nav.getBoundingClientRect(), rb = root.getBoundingClientRect(), sb = sum?.getBoundingClientRect();
      return { barH: Math.round(nb.height), rootTop: Math.round(rb.top), sumTop: sb ? Math.round(sb.top) : null, soundInBar: !!sound && nav.contains(sound), cur: document.querySelector('#labs-panel a[aria-current=page]')?.dataset.lab, now: document.getElementById('labs-now')?.textContent ?? '', tiles: document.querySelectorAll('#labs-panel a.lp-tile').length, cssVar: getComputedStyle(document.documentElement).getPropertyValue('--labs-nav-h').trim() };
    }, mode);
  };
  let mode = modes[0];
  for (let i = 0; i < modes.length; i++) {
    const r = await probe(mode);
    order.push(mode);
    if (r.barH !== 34 || r.cssVar !== '34px') fail.push(`${mode}: bar ${r.barH}px var ${r.cssVar}`);
    if (r.rootTop !== 34) fail.push(`${mode}: Lab starts at ${r.rootTop}px, not under the bar`);
    if (r.sumTop !== null && r.sumTop < 34) fail.push(`${mode}: summary at ${r.sumTop}px is under the bar`);
    if (!r.soundInBar) fail.push(`${mode}: Sound button not in the bar`);
    if (r.cur !== mode) fail.push(`${mode}: panel marks ${r.cur}`);
    if (!r.now.trim()) fail.push(`${mode}: bar does not name the Lab`);
    if (r.tiles !== modes.length) fail.push(`${mode}: ${r.tiles} tiles`);
    if (i === 0 || i === Math.floor(modes.length / 2) || i === modes.length - 1) await page.screenshot({ path: `${out}/${mode}.png` });
    if (i < modes.length - 1) {
      const href = await page.getAttribute('#labs-next', 'href');
      await Promise.all([page.waitForURL((u) => u.search.includes('mode=') && !u.search.includes(`mode=${mode}&`)), page.click('#labs-next')]);
      mode = new URL(page.url()).searchParams.get('mode');
      if (!href || !href.includes(mode)) fail.push(`Next href ${href} vs ${mode}`);
    }
  }
  // Previous goes back one, [ and ] work
  await Promise.all([page.waitForURL(`**mode=${order[order.length - 2]}&**`), page.click('#labs-prev')]);
  await page.waitForSelector(`#${order[order.length - 2]}`, { timeout: 90000 });
  await Promise.all([page.waitForURL(`**mode=${order[order.length - 1]}&**`), page.keyboard.press(']')]);
  await page.waitForSelector(`#${order[order.length - 1]}`, { timeout: 90000 });
  // labs off: no bar
  await page.goto(`http://localhost:${port}/?labs=0&welcome=0&sunat=noon&backend=webgl2&mode=lab-search`);
  await page.waitForTimeout(3000);
  if (await page.locator('#labs-nav').count()) fail.push('bar shown with labs=0');
  await page.goto(`${base}&mode=lab-search`); // restore the switch
  console.log('labs walked:', order.length, 'errors:', errors, 'fail:', fail);
  await browser.close();
  process.exit(errors.length || fail.length ? 1 : 0);
} finally { server.kill(); }
