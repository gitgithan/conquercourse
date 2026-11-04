// CC-133: the hint, the toasts and the dimmed older hints sit in the sky band at the top-centre, never over the runner or the HUD (1280 x 720, desktop).
// Usage (on a VM): OUT=docs/evidence/cc-133-bulbs-toasts node scripts/toast-band-check.mjs
// Shots: the bulb course on the run-up with the pole toast, the climb up the pole, and another course (the bars) with a toast in the same place.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? String(5300 + Math.floor(Math.random() * 600)), out = process.env.OUT ?? 'docs/evidence/cc-133-bulbs-toasts';
mkdirSync(out, { recursive: true });
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const results = []; const check = (name, ok, extra = '') => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, extra); };
const flags = ['--use-angle=swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
const boxes = (page) => page.evaluate(() => {
  const r = (e) => { const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right }; };
  const band = document.getElementById('toast-band');
  const kids = band ? [...band.querySelectorAll('div')].filter((e) => e.offsetHeight > 0 && e.children.length === 0 && e.textContent.trim()).map((e) => ({ t: e.textContent.slice(0, 30), ...r(e) })) : [];
  const others = ['strip', 'coursebtns'].map((id) => document.getElementById(id)).filter(Boolean).map((e) => ({ id: e.id, ...r(e) }));
  return { band: band ? r(band) : null, kids, others, vh: innerHeight, hint: document.documentElement.dataset.mode };
});
const hit = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
const verify = (tag, b) => {
  check(`${tag}: the band exists`, !!b.band);
  check(`${tag}: its top is in the top fifth`, b.band.top <= 0.2 * b.vh, `top ${b.band.top}`);
  check(`${tag}: its bottom is above the runner's head (under 40%)`, b.band.bottom <= 0.4 * b.vh + 1, `bottom ${b.band.bottom}`);
  check(`${tag}: no message touches the strip or the buttons`, b.kids.every((k) => b.others.every((o) => !hit(k, o))), JSON.stringify(b.kids.map((k) => k.t)));
};
const play = async (page, url, until) => {
  await page.goto(`http://localhost:${port}/${url}`);
  await page.waitForSelector('html[data-ready=true]', { state: 'attached', timeout: 180000 });
  await page.waitForTimeout(1500);
  await until();
};
try {
  await new Promise((r) => setTimeout(r, 5000));
  const browser = await chromium.launch({ args: flags });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const x = () => page.evaluate(() => Number(document.documentElement.dataset.x));
  // 1. the bulb course: the pole toast on the run-up, then the climb
  await play(page, '?course=/assets/demo/fork-bench-bulb.course.json&welcome=0&tour=0&backend=webgl2&sunat=noon', async () => {
    await page.keyboard.down('ArrowRight');
    await page.waitForFunction(() => Number(document.documentElement.dataset.x) >= 5.5, null, { timeout: 120000 });
    await page.waitForTimeout(300);
    const b = await boxes(page); console.log(JSON.stringify(b.kids));
    await page.screenshot({ path: `${out}/bulbs-pole-toast.png` });
    verify('bulbs run-up', b);
    check('bulbs run-up: the pole toast is on screen', b.kids.some((k) => /pole/i.test(k.t)), JSON.stringify(b.kids));
    await page.keyboard.down('e');
    await page.waitForFunction(() => Number(document.documentElement.dataset.x) >= 9.4, null, { timeout: 60000 });
    await page.keyboard.up('ArrowRight');
    await page.waitForFunction(() => document.documentElement.dataset.mode === 'polec', null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const c = await boxes(page); console.log(c.hint, JSON.stringify(c.kids));
    await page.screenshot({ path: `${out}/bulbs-high-path.png` });
    verify('bulbs high path', c);
    await page.keyboard.up('e');
  });
  // 2. another course: a bar course shows its toast in the same place
  await play(page, '?course=/assets/demo/lache.course.json&welcome=0&tour=0&backend=webgl2&sunat=noon', async () => {
    await page.keyboard.down('ArrowRight');
    let b = null;
    for (let i = 0; i < 80 && !(b?.kids.length); i++) { await page.waitForTimeout(250); b = await boxes(page); }
    await page.screenshot({ path: `${out}/lache-toast.png` });
    console.log(JSON.stringify(b.kids));
    check('lache: a message is showing', b.kids.length > 0);
    verify('lache', b);
  });
  await browser.close();
} catch (e) { console.log('FAIL error', e.message); results.push(false); }
server.kill();
process.exit(results.every(Boolean) && results.length ? 0 : 1);
