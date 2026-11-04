// The Labs panel in the browser at 1280 px: slim bar closed, panel slides down, boxes and lines, hover dims, Esc / close / pick close it, old ?mode=labs-map link opens it.
// Screenshots go to test-results/labs-panel/ (copy them to docs/evidence/cc-133-pipeline-labs/).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5184';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const result = {};
let failed = false;
const check = (name, ok, extra = '') => { result[name] = ok ? 'ok' : `FAILED ${extra}`; if (!ok) failed = true; };
const hidden = (page) => page.evaluate(() => getComputedStyle(document.getElementById('labs-panel')).visibility === 'hidden');
try {
  await new Promise((r) => setTimeout(r, 5000));
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  mkdirSync('test-results/labs-panel', { recursive: true });
  const base = `http://localhost:${port}`, errors = [];
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await page.goto(`${base}/?mode=lab-search&labs=1&welcome=0&sunat=noon&backend=webgl2`);
  await page.waitForSelector('#labs-open', { timeout: 90000 });
  await page.waitForTimeout(1500);
  const bar = await page.evaluate(() => ({ h: document.getElementById('labs-nav').offsetHeight, v: getComputedStyle(document.documentElement).getPropertyValue('--labs-nav-h'), top: document.getElementById('lab-search').getBoundingClientRect().top, vis: getComputedStyle(document.getElementById('labs-panel')).visibility, mapLink: !!document.getElementById('labs-map-link') }));
  check('slim bar', bar.h <= 40 && bar.v.trim() === `${bar.h}px` && Math.abs(bar.top - bar.h) < 1, JSON.stringify(bar));
  check('panel hidden at rest, no Map link', bar.vis === 'hidden' && !bar.mapLink, JSON.stringify(bar));
  await page.screenshot({ path: 'test-results/labs-panel/closed.png' });
  await page.click('#labs-open');
  await page.waitForTimeout(700);
  const open = await page.evaluate(() => {
    const p = document.getElementById('labs-panel'), r = p.getBoundingClientRect(), body = document.getElementById('lp-body');
    const tiles = [...p.querySelectorAll('a.lp-tile')], boxes = [...p.querySelectorAll('.lp-box')];
    const ov = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const br = boxes.map((b) => b.getBoundingClientRect());
    let overlaps = 0; for (let i = 0; i < br.length; i++) for (let j = i + 1; j < br.length; j++) if (ov(br[i], br[j])) overlaps++;
    const inside = tiles.every((t) => { const b = t.closest('.lp-box').getBoundingClientRect(), a = t.getBoundingClientRect(); return a.left >= b.left - 1 && a.right <= b.right + 1 && a.bottom <= b.bottom + 1; });
    return { top: r.top, h: r.height, tiles: tiles.length, boxes: boxes.length, overlaps, inside, paths: p.querySelectorAll('#lp-lines path').length, sw: body.scrollWidth, cw: body.clientWidth, icons: p.querySelectorAll('a.lp-tile svg').length };
  });
  check('panel slid down', open.top === 0 && open.h > 300, JSON.stringify(open));
  check('a tile and an icon for every Lab', open.tiles >= 20 && open.icons === open.tiles, JSON.stringify(open));
  check('boxes do not overlap, tiles inside', open.overlaps === 0 && open.inside, JSON.stringify(open));
  check('lines drawn', open.paths >= 13, JSON.stringify(open));
  check('no sideways scroll at 1280', open.sw <= open.cw, JSON.stringify(open));
  await page.screenshot({ path: 'test-results/labs-panel/open.png' });
  await page.hover('#labs-panel a.lp-tile[data-lab="lab-collision"]');
  const hov = await page.evaluate(() => ({ dim: document.querySelectorAll('#labs-panel a.lp-tile.dim').length, bright: document.querySelectorAll('#labs-panel a.lp-tile:not(.dim)').length, hot: document.querySelectorAll('#lp-lines path.hot').length }));
  check('hover dims all but neighbours', hov.dim > 10 && hov.bright >= 2 && hov.hot >= 1, JSON.stringify(hov));
  await page.screenshot({ path: 'test-results/labs-panel/hover.png' });
  await page.mouse.move(640, 790);
  const cover = await page.evaluate(() => { const sb = document.getElementById('soundbutton'), nav = document.getElementById('labs-nav'); return { inBar: !!sb && nav.contains(sb) }; });
  check('Sound button in the bar', cover.inBar, JSON.stringify(cover));
  await page.keyboard.press('Escape'); await page.waitForTimeout(600);
  check('Esc closes', await hidden(page));
  await page.click('#labs-open'); await page.waitForTimeout(600);
  await page.mouse.click(640, 790); await page.waitForTimeout(600);
  check('backdrop click closes', await hidden(page));
  check('Courses still reachable', await page.evaluate(() => { const b = document.getElementById('labs-courses').getBoundingClientRect(); return b.width > 0 && document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)?.id === 'labs-courses'; }));
  await page.click('#labs-open'); await page.waitForTimeout(600);
  await page.click('#labs-panel-close'); await page.waitForTimeout(600);
  check('close button closes', await hidden(page));
  await page.click('#labs-open'); await page.waitForTimeout(600);
  await Promise.all([page.waitForURL(/mode=lab-wait/), page.click('#labs-panel a.lp-tile[data-lab="lab-wait"]')]);
  check('picking a Lab opens it', page.url().includes('mode=lab-wait'), page.url());
  await page.waitForSelector('#labs-now', { timeout: 90000 });
  check('bar names the current Lab', (await page.textContent('#labs-now')).includes('Hide the wait'));
  for (const m of ['lab-camera', 'lab-limits', 'lab-collision']) {
    await page.goto(`${base}/?mode=${m}&labs=1&welcome=0&sunat=noon&backend=webgl2`);
    await page.waitForSelector('#labs-open', { timeout: 90000 }); await page.waitForTimeout(2000);
    await page.screenshot({ path: `test-results/labs-panel/${m}.png` });
  }
  await page.goto(`${base}/?mode=labs-map&labs=1&sunat=noon&backend=webgl2`);
  await page.waitForSelector('#labs-panel.open', { timeout: 90000 });
  check('old labs-map link opens the panel', true);
  check('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
} catch (e) { check('run', false, String(e)); } finally { server.kill(); }
console.log(JSON.stringify(result, null, 2));
process.exit(failed ? 1 : 0);
