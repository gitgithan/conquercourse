// The debug card (B): on every course and size it is on screen, overlaps no other fixed panel, has no clipped or wrapped text,
// no line over 8 words (tooltips and the closed "What is this?" row excepted), and fits without scrolling when its sections are folded.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const port = 5897, dir = 'data/eval/cc-98-debug-panel'; mkdirSync(dir, { recursive: true });
const v = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 7000));
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const courses = { stock: '', lache: '/assets/demo/lache.course.json', climb: '/assets/demo/climb.course.json', cannon: '/assets/demo/cannon.course.json', band: '/assets/demo/band.course.json', coaster: '/assets/demo/coaster.course.json', drone: '/assets/demo/drone.course.json' };
let fails = 0; const fail = (m) => { fails++; console.log('FAIL', m); };
const inspect = () => {
  const panel = document.getElementById('debugpanel'); if (!panel || getComputedStyle(panel).display === 'none') return { error: 'panel not shown' };
  const rect = (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
  const pr = panel.getBoundingClientRect(), out = { panel: rect(panel), scroll: panel.scrollHeight - panel.clientHeight, overlaps: [], clipped: [], wordy: [] };
  if (pr.left < 0 || pr.top < 0 || pr.right > innerWidth || pr.bottom > innerHeight) out.off = true;
  for (const e of document.body.querySelectorAll('*')) {
    if (panel.contains(e) || e === panel || e.contains(panel) || e.tagName === 'CANVAS' || e.tagName === 'SCRIPT' || e.tagName === 'STYLE') continue;
    const cs = getComputedStyle(e); if (!(cs.position === 'fixed' || cs.position === 'absolute') || cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const r = e.getBoundingClientRect(); if (r.width < 8 || r.height < 8) continue;
    if (e.parentElement && e.parentElement !== document.body && getComputedStyle(e.parentElement).position === 'fixed') continue; // judge the outer panel only
    const ox = Math.min(pr.right, r.right) - Math.max(pr.left, r.left), oy = Math.min(pr.bottom, r.bottom) - Math.max(pr.top, r.top);
    if (ox > 4 && oy > 4) out.overlaps.push((e.id || e.className || e.tagName).toString().slice(0, 30));
  }
  for (const e of panel.querySelectorAll('*')) {
    if (e.closest('[data-tip]') && getComputedStyle(e.closest('[data-tip]')).display === 'none') continue;
    if (e.children.length) continue;
    const t = (e.textContent ?? '').trim(); if (!t) continue;
    if (e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).display !== 'inline') out.clipped.push(t.slice(0, 30));
    if (!e.closest('[data-tip]') && t.split(/\s+/).length > 8) out.wordy.push(t.slice(0, 40));
  }
  return out;
};
for (const [name, path] of Object.entries(courses)) for (const [w, h] of [[1280, 720], [1024, 640]]) {
  const page = await b.newPage({ viewport: { width: w, height: h } });
  await page.goto(`http://localhost:${port}/?${path ? `course=${path}&` : ''}welcome=0&debug=1`, { waitUntil: 'load' });
  await page.waitForTimeout(5000);
  for (const phase of ['start', ...(name === 'lache' || name === 'climb' ? ['running'] : [])]) {
    if (phase === 'running') { await page.keyboard.down('ArrowRight'); await page.waitForTimeout(2500); await page.keyboard.up('ArrowRight'); await page.waitForTimeout(300); }
    const r = await page.evaluate(inspect); const tag = `${name} ${w}x${h} ${phase}`;
    if (r.error) { fail(`${tag}: ${r.error}`); continue; }
    if (r.off) fail(`${tag}: card off screen ${JSON.stringify(r.panel)}`);
    if (r.scroll > 1) fail(`${tag}: card scrolls (${r.scroll}px) with sections folded`);
    if (r.overlaps.length) fail(`${tag}: overlaps ${r.overlaps.join(', ')}`);
    if (r.clipped.length) fail(`${tag}: clipped text ${r.clipped.join(' | ')}`);
    if (r.wordy.length) fail(`${tag}: more than 8 words ${r.wordy.join(' | ')}`);
    if (phase === 'start') await page.screenshot({ path: `${dir}/after-${name}-${w}.png` });
    if (phase === 'running') await page.screenshot({ path: `${dir}/after-${name}-running-${w}.png` });
  }
  if (name === 'lache' && w === 1280) {
    // the switches: open a section, turn an overlay off, it is remembered; Esc closes the card
    await page.click('#debugpanel .dp-sec > button >> nth=0'); await page.uncheck('#debugpanel input >> nth=0');
    const saved = await page.evaluate(() => localStorage.getItem('cc.debug.layers'));
    if (!saved || JSON.parse(saved).ground !== false) fail('lache: the Ground switch was not remembered');
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    if (await page.evaluate(() => getComputedStyle(document.getElementById('debugpanel')).display) !== 'none') fail('lache: Esc did not close the card');
    await page.keyboard.press('KeyB'); await page.waitForTimeout(200);
    if (await page.evaluate(() => getComputedStyle(document.getElementById('debugpanel')).display) === 'none') fail('lache: B did not open the card');
  }
  await page.close();
}
await b.close(); v.kill(); console.log(fails ? `${fails} failures` : 'debug panel check: all passed'); process.exit(fails ? 1 : 0);
