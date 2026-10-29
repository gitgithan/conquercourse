// CC-186 (1): the Training course, ideal line played from start to finish on the stepped clock in the real page.
import { launch, ok, save, frames, shot, base, OUT } from './lib.mjs';
import { writeFileSync } from 'node:fs';
const b = await launch();
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.addInitScript(`(() => { let t = 1000; const real = window.requestAnimationFrame.bind(window); performance.now = () => t; window.__stepClock = (ms) => { t += ms; return t; }; window.requestAnimationFrame = (cb) => real(() => cb(t)); })();`);
await page.addInitScript(() => { try { localStorage.setItem('cc.worldWelcome.seen', '1'); } catch {} });
await page.goto(`${base}/?course=/assets/demo/training.course.json&bot=ideal&welcome=0&tour=0`, { waitUntil: 'load' });
await page.waitForSelector('html[data-ready=true]', { timeout: 120000 });
await frames(page, 5);
const strip = () => page.evaluate(() => [...document.querySelectorAll('#strip .ob')].map((e) => ({ t: e.textContent.trim(), c: e.className })));
const drums = () => page.evaluate(() => [...(document.querySelector('#drums')?.children ?? [])].map((e) => e.textContent.trim()).filter(Boolean));
const s0 = await strip(); const d0 = await drums();
console.log('strip', JSON.stringify(s0)); console.log('drums', JSON.stringify(d0));
await shot(page, 'training-start');
ok('1 training', 'strip shows 10 obstacles (gap, vault, step, wall, climb, plank, lache, rope, trampoline, drop)', s0.length === 10, s0.map((s) => s.t).join(','));
ok('1 training', 'drum lane lists E, V, X and Space', ['E', 'V', 'X', 'Space'].every((k) => d0.some((d) => d.startsWith(k))), d0.join(' '));
let fine = 0; const seen = new Set(); let tipSeen = false, tipShot = false, grabShot = 0, lastMode = '', i = 0, state, fallPanel = false;
const log = [];
for (; i < 7000; i++) {
  await page.evaluate(async (ms) => { window.__stepClock(ms); await new Promise((r) => requestAnimationFrame(() => r())); }, fine > 0 ? 1000 / 60 : 200); if (fine > 0) fine--;
  state = await page.evaluate(() => ({ m: document.documentElement.dataset.mode, o: document.documentElement.dataset.outcome, x: Number(document.documentElement.dataset.x), tick: document.documentElement.dataset.tick, tip: [...document.querySelectorAll('div')].some((d) => d.textContent === 'Hold E to grab' && getComputedStyle(d).display !== 'none'), rep: !!document.querySelector('#report-again'), toast: [...document.querySelectorAll('#msg,[id=toast]')].map((e) => getComputedStyle(e).display !== 'none' ? e.textContent : '').join('') }));
  if (state.m !== lastMode) { log.push(`${state.tick} x=${state.x} mode ${lastMode}->${state.m}`); if (!seen.has(state.m)) { seen.add(state.m); await shot(page, `training-mode-${state.m}-x${Math.round(state.x)}`); } lastMode = state.m; }
  if (state.tip && !tipShot) { tipShot = true; tipSeen = true; await shot(page, 'training-hold-e-tip'); }
  if (state.m === 'hang' && grabShot < 3) { grabShot++; await shot(page, `training-lache-grab-${grabShot}`); await frames(page, 8); }
  if (i % 25 === 0) await shot(page, `training-run-${String(i).padStart(4, '0')}-x${Math.round(state.x)}`);
  if (state.o !== 'running' || state.rep || state.x > 232) break;
}
await frames(page, 30); await page.waitForTimeout(800);
const fin = await page.evaluate(() => ({ o: document.documentElement.dataset.outcome, rep: !!document.querySelector('#report-again'), x: document.documentElement.dataset.x, t: document.body.innerText.slice(0, 300) }));
await shot(page, 'training-finish');
const s1 = await strip();
ok('1 training', 'stored ideal line clears from start to finish', fin.o === 'finished' || fin.rep, JSON.stringify({ outcome: fin.o, report: fin.rep, x: fin.x }));
ok('1 training', 'every strip icon is done at the end', s1.every((s) => /done/.test(s.c)), s1.map((s) => s.t + ':' + s.c.replace('ob ', '')).join(' '));
ok('1 training', '"Hold E to grab" tip shown at the warped wall', tipSeen);
ok('1 training', 'no page errors', errs.length === 0, errs.slice(0, 3).join(' | ').slice(0, 300));
writeFileSync(OUT + 'training-modes.log', log.join('\n') + '\n');
console.log(log.join('\n'));
save('run-training.json'); await b.close();
