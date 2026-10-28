// CC-84: the first minute. For the courses in the demo menu: the front-view window is shown and draws on every one; the wheel zooms the
// camera in to the face (about 0.7 m from the head) and a double-click resets it; the menu is grouped with real places first.
//   node scripts/experience-check.mjs        (screenshots in test-results/experience/)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5173';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const flags = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist'];
const out = { groups: [], front: {}, face: null, errors: [] };
try {
  await new Promise((r) => setTimeout(r, 3000));
  const browser = await chromium.launch({ args: flags });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => out.errors.push(e.message.slice(0, 160)));
  mkdirSync('test-results/experience', { recursive: true });
  const open = async (url) => {
    await page.goto(`http://localhost:${port}/${url}`);
    await page.waitForSelector('#courses-btn', { timeout: 90000 });
    await page.waitForFunction(() => document.documentElement.dataset.tick !== undefined, null, { timeout: 90000 });
    await page.waitForTimeout(1500);
  };
  await page.goto(`http://localhost:${port}/`); // the first-run chooser
  await page.waitForSelector('#choose-world', { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(1500);
  out.welcome = await page.evaluate(() => !!document.getElementById('choose-world'));
  out.welcomeCards = await page.evaluate(() => document.querySelectorAll('#choose-world .wg-card').length); // the first-run chooser is the picture gallery
  out.groups = await page.$$eval('#choose-world section', (gs) => gs.map((g) => `${g.dataset.group}: ${g.querySelectorAll('.wg-card').length}`));
  const cards = await page.$$eval('#choose-world .wg-card', (cs) => cs.map((c) => [c.dataset.value, c.querySelector('b').textContent]));
  out.menuHasLanes = cards.some(([, t]) => /Demo scene/.test(t ?? ''));
  await page.screenshot({ path: 'test-results/experience/welcome.png' });
  await open('?course=/assets/demo/park-rail-run.course.json');
  await page.click('#courses-btn'); await page.waitForTimeout(600);
  await page.screenshot({ path: 'test-results/experience/menu.png' }); // the Courses overlay
  await page.keyboard.press('Escape');
  const options = cards.filter(([v]) => v.startsWith('/assets'));
  // the front view on every menu course
  for (const [v, label] of options) {
    await open(`?course=${v}`);
    out.front[label] = await page.evaluate(() => { const f = document.getElementById('frontview'); return !!f && getComputedStyle(f).display !== 'none'; });
    if (['park-rail-run', 'montmartre-paris', 'coaster.course', 'launch.course'].some((k) => v.includes(k))) await page.screenshot({ path: `test-results/experience/front-${v.split('/').pop().replace(/\W+/g, '_')}.png` });
    else if (!out.front[label]) await page.screenshot({ path: `test-results/experience/NOFRONT-${v.split('/').pop().replace(/\W+/g, '_')}.png` });
  }
  // F hides it, F shows it again
  await open('?course=/assets/demo/park-rail-run.course.json');
  const shown = (want) => page.waitForFunction((w) => (getComputedStyle(document.getElementById('frontview')).display !== 'none') === w, want, { timeout: 30000 }).then(() => true, () => false);
  await page.keyboard.press('KeyF'); out.fOff = await shown(false);
  await page.keyboard.press('KeyF'); out.fOn = await shown(true);
  // the face zoom
  const dist = () => page.evaluate(() => Number(document.documentElement.dataset.camdist));
  const d0 = await dist();
  await page.mouse.move(640, 360);
  for (let i = 0; i < 60; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(40); }
  await page.waitForFunction(() => Number(document.documentElement.dataset.camdist) < 1.0, null, { timeout: 60000 }).catch(() => {});
  const d1 = await dist();
  await page.screenshot({ path: 'test-results/experience/face-zoom.png' });
  await page.mouse.dblclick(640, 360);
  await page.waitForFunction((d) => Number(document.documentElement.dataset.camdist) > d * 0.8, d0, { timeout: 60000 }).catch(() => {});
  const d2 = await dist();
  out.face = { start: d0, closest: d1, afterReset: d2, ok: d1 < 1.1 && d2 > d0 * 0.8 };
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
  const bad = Object.entries(out.front).filter(([, v]) => !v).map(([k]) => k);
  if (bad.length || !out.fOff || !out.fOn || !out.face.ok || out.menuHasLanes || out.errors.length) { console.log('FAIL', { bad, fOff: out.fOff, fOn: out.fOn, face: out.face.ok, menuHasLanes: out.menuHasLanes }); process.exitCode = 1; }
} finally { server.kill(); }
