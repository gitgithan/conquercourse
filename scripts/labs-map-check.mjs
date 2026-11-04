// The Labs map in the browser at 1280 px: off without the labs switch; with it every Lab is a box, hover and keyboard focus dim the rest, a click opens the Lab.
// Screenshots go to test-results/labs-map/ (copy them to docs/evidence/cc-133-pipeline-labs/).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT ?? '5184';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', port, '--strictPort'], { stdio: 'ignore' });
const result = {};
let failed = false;
const check = (name, ok, extra = '') => { result[name] = ok ? 'ok' : `FAILED ${extra}`; if (!ok) failed = true; };
try {
  await new Promise((r) => setTimeout(r, 4000));
  const browser = await chromium.launch({ args: process.env.WEBGL2 ? ['--use-gl=angle', '--use-angle=swiftshader'] : [] });
  mkdirSync('test-results/labs-map', { recursive: true });
  const base = `http://localhost:${port}`, errors = [];
  const off = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  off.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await off.goto(`${base}/?mode=labs-map&labs=0&backend=webgl2`);
  await off.waitForSelector('#labs-map', { timeout: 60000 });
  check('off message', (await off.textContent('#labs-map')).includes('Labs are switched off'));
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await page.goto(`${base}/?mode=labs-map&labs=1&sunat=noon&backend=webgl2`);
  await page.waitForFunction(() => document.documentElement.dataset.labPopulated === 'labs-map', null, { timeout: 90000 });
  const info = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('#lmap-svg a.node')], edges = [...document.querySelectorAll('#lmap-svg path.edge')];
    const boxes = nodes.map((n) => n.getBoundingClientRect());
    let overlaps = 0;
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const a = boxes[i], b = boxes[j]; if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) overlaps++; }
    const clipped = nodes.filter((n) => { const r = n.querySelector('rect').getBoundingClientRect(), t = n.querySelector('.name').getBoundingClientRect(); return t.right > r.right - 4; }).length;
    return { nodes: nodes.length, edges: edges.length, overlaps, clipped, scrollW: document.getElementById('labs-map').scrollWidth, innerW: innerWidth, dimmed: document.querySelectorAll('#lmap-svg .dim').length };
  });
  check('a box for every Lab', info.nodes >= 15, JSON.stringify(info));
  check('lines drawn', info.edges >= 15, JSON.stringify(info));
  check('no overlapping boxes', info.overlaps === 0, JSON.stringify(info));
  check('no label runs out of its box', info.clipped === 0, JSON.stringify(info));
  check('no sideways scroll at 1280', info.scrollW <= info.innerW, JSON.stringify(info));
  check('nothing dimmed at rest', info.dimmed === 0, JSON.stringify(info));
  await page.screenshot({ path: 'test-results/labs-map/default.png', fullPage: true });
  const target = (await page.$$eval('#lmap-svg a.node', (a) => a.map((x) => x.dataset.lab))).find((m) => m === 'lab-collision') ?? (await page.$eval('#lmap-svg a.node', (a) => a.dataset.lab));
  await page.hover(`#lmap-svg a.node[data-lab="${target}"]`);
  const hov = await page.evaluate(() => ({ dim: document.querySelectorAll('#lmap-svg a.node.dim').length, bright: document.querySelectorAll('#lmap-svg a.node:not(.dim)').length, hot: document.querySelectorAll('#lmap-svg path.hot').length, edgesBright: document.querySelectorAll('#lmap-svg path.edge:not(.dim)').length, says: document.getElementById('lmap-says').textContent }));
  check('hover dims the others', hov.dim > 0 && hov.bright >= 2 && hov.hot === hov.edgesBright && hov.hot >= 1, JSON.stringify(hov));
  check('hover explains the lines', /Uses|Feeds|Comes from|Used by/.test(hov.says), hov.says);
  await page.screenshot({ path: 'test-results/labs-map/hover.png', fullPage: true });
  await page.mouse.move(2, 2);
  check('leaving restores', (await page.$$eval('#lmap-svg .dim', (e) => e.length)) === 0);
  await page.focus(`#lmap-svg a.node[data-lab="${target}"]`);
  check('keyboard focus dims the others', (await page.$$eval('#lmap-svg a.node.dim', (e) => e.length)) === hov.dim);
  await Promise.all([page.waitForURL(new RegExp(`mode=${target}`)), page.click(`#lmap-svg a.node[data-lab="${target}"]`)]);
  check('click opens the Lab', page.url().includes(`mode=${target}`), page.url());
  await page.goto(`${base}/?mode=lab-search&labs=1&backend=webgl2`);
  await page.waitForSelector('#labs-map-link', { timeout: 60000 });
  check('Lab pages link to the map', true);
  check('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
} catch (e) { check('run', false, String(e)); } finally { server.kill(); }
console.log(JSON.stringify(result, null, 2));
process.exit(failed ? 1 : 0);
