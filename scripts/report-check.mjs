// The end-of-run report (CC-97): a bot-cleared run shows the result line, the picture with path and icons, you next to the best line, the move costs, the saying and the buttons, readable at 1024x640 and 1280x720.
// Usage: node scripts/report-check.mjs [outdir]   (own vite port; at most one browser run at a time)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'data/eval/cc-97-report'; mkdirSync(out, { recursive: true });
const port = 5873;
const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 6000));
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const results = []; const ok = (name, pass, note = '') => { results.push({ name, pass, note }); console.log(pass ? 'PASS' : 'FAIL', name, note); };
const errors = [];
for (const [w, h] of [[1024, 640], [1280, 720]]) {
  const page = await b.newPage({ viewport: { width: w, height: h } });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://localhost:${port}/?course=/assets/demo/lache.course.json&bot=ideal&welcome=0`, { waitUntil: 'load' });
  const got = await page.waitForSelector('#report-again', { timeout: 180000 }).then(() => true).catch(() => false);
  ok(`${w}x${h} the report appears after a cleared run`, got);
  if (got) {
    const m = await page.evaluate(() => {
      const box = document.querySelector('section[aria-label="Run report"]'); const r = box.getBoundingClientRect();
      const panel = box.parentElement; const pr = panel.getBoundingClientRect();
      const btns = [...box.querySelectorAll('button')].map((x) => ({ t: x.textContent, clipped: x.scrollWidth > x.clientWidth + 1, h: x.getBoundingClientRect().height }));
      return { text: box.innerText, hasSvg: !!box.querySelector('svg'), icons: box.querySelectorAll('svg svg').length, slot: !!box.querySelector('#report-ghost-slot'), panelFits: pr.top >= 0 && pr.bottom <= innerHeight + 1 && pr.left >= 0 && pr.right <= innerWidth + 1, btns, scrollX: document.documentElement.scrollWidth > innerWidth };
    });
    ok(`${w}x${h} headline says time`, /You made it in [\d.]+ s/.test(m.text), m.text.split('\n')[0]);
    ok(`${w}x${h} you and the best line side by side`, /Best line/.test(m.text) && /Time/.test(m.text) && /Effort/.test(m.text));
    ok(`${w}x${h} path picture with move icons`, m.hasSvg && m.icons > 0, `${m.icons} icons`);
    ok(`${w}x${h} a cost per move in words`, /effort/.test(m.text));
    ok(`${w}x${h} what you learned`, /What you learned/.test(m.text));
    ok(`${w}x${h} the spot for the ghost button`, m.slot);
    ok(`${w}x${h} buttons are not clipped or wrapped`, m.btns.every((x) => !x.clipped && x.h < 48), JSON.stringify(m.btns.map((x) => x.t)));
    ok(`${w}x${h} the panel fits the window, no page scroll`, m.panelFits && !m.scrollX);
    await page.screenshot({ path: `${out}/report-${w}x${h}.png` });
  }
  await page.close();
}

{ // a run that ends in the water: how far you got, the path and the moves, no comparison
  const page = await b.newPage({ viewport: { width: 1024, height: 640 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://localhost:${port}/?welcome=0`, { waitUntil: 'load' });
  await page.waitForTimeout(3000); await page.keyboard.down('ArrowRight');
  const got = await page.waitForSelector('section[aria-label="Run report"]', { timeout: 120000 }).then(() => true).catch(() => false);
  await page.keyboard.up('ArrowRight');
  ok('a fall shows the short report', got);
  if (got) {
    const t = await page.evaluate(() => document.querySelector('section[aria-label="Run report"]').innerText);
    ok('the fall report says how far you got', /You got \d+ m of \d+ m/.test(t), t.split('\n')[0]);
    ok('the fall report has no best line or score', !/Best line|score|\/100/i.test(t));
    await page.screenshot({ path: `${out}/report-fall-1024x640.png` });
  }
  await page.close();
}
ok('no page errors', errors.length === 0, errors.join(' | ').slice(0, 200));
await b.close(); vite.kill();
process.exit(results.every((r) => r.pass) ? 0 : 1);
