// CC-143 film shot 2 (v2): a plain screen recording of the real World Slicer. No overlay, no camera jumps, no edits.
// usage: node shot2.mjs <playwright> <outdir> [spec.json]
// Stepped clock: performance.now is ours, one step per picture, so the real flight plays smooth and at true speed even on a software GPU.
// Real waits (network, page load) run with the clock moving in small steps and no pictures taken.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
const [pw, out, specFile] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specFile || new URL('./shot2.spec.json', import.meta.url), 'utf8'));
const fps = spec.fps ?? 30, dt = 1000 / fps;
const { chromium } = await import(pw);
const b = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl-egl'] });
const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
p.on('pageerror', (e) => console.log('pageerror', e.message.slice(0, 200)));
await p.addInitScript(`(() => { let t = 0; performance.now = () => t; window.__stepClock = (ms) => { t += ms; return t; }; })();`);
mkdirSync(out, { recursive: true });
let n = 0; const marks = {};
const tick = () => p.evaluate((m) => { window.__stepClock(m); return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); }, dt);
const shot = async () => { await p.screenshot({ path: `${out}/f${String(n++).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92, timeout: 180000 }); };
const rec = async (sec, each) => { const k = Math.round(sec * fps); for (let i = 0; i < k; i++) { if (each) await each(i / Math.max(1, k - 1)); await tick(); await shot(); } };
const until = async (fn, label, ms = 120000, record = false) => { const t0 = Date.now(); for (;;) { if (await p.evaluate(fn).catch(() => false)) return true; if (Date.now() - t0 > ms) { console.log('timeout', label); return false; } await tick(); if (record) await shot(); await p.waitForTimeout(60); } };
const mark = (k) => { marks[k] = n / fps; console.log('mark', k, marks[k].toFixed(2)); };

await p.goto(spec.url);
await until(() => !!window.__ccMap && document.documentElement.dataset.mapready !== undefined || !!document.querySelector('#slice'), 'load');
await until(() => document.documentElement.dataset.mapready === '1' || !!document.querySelector('.maplibregl-canvas'), 'map');
await p.addStyleTag({ content: '#cc-feedback-btn{display:none!important}' });
await rec(spec.holdStart ?? 1.2); mark('top-view');
// 1. choose the place by clicking its picture card in the open right panel
await p.locator(`.side >> text=${spec.place}`).first().click();
await rec(spec.afterPlace ?? 1.8); mark('place-chosen');
// 2. slice: the real flight (top view -> buildings rise -> low side camera) plays by itself
await p.click('#slice'); mark('slice');
await until(() => document.documentElement.dataset.flightDone === '1' || !!document.querySelector('[data-flight-done="1"]'), 'flight', 400000, true);
await rec(spec.afterFlight ?? 1.5); mark('flight-done');
const lane = await p.evaluate(() => document.querySelector('[data-slice-lane]')?.getAttribute('data-slice-lane'));
console.log('lane', lane);
// 3. the side panel: scroll down smoothly to the cut strip, then the street photos
const scrollTo = (to, sec) => p.evaluate(() => document.querySelector('.side').scrollTop).then((from) => rec(sec, (u) => p.evaluate(([f, t, k]) => { document.querySelector('.side').scrollTop = f + (t - f) * (k * k * (3 - 2 * k)); }, [from, to, u])));
await scrollTo(spec.scrollCut ?? 760, 1.5); await rec(spec.holdCut ?? 1.5); mark('cut-strip');
await until(() => { const e = document.querySelector('#streetpanel'); return !!e && /^[1-9]/.test(e.dataset.thumbs || '') || e?.dataset.thumbs === 'failed'; }, 'street-thumbs', 90000);
const st = await p.evaluate(() => ({ thumbs: document.querySelector('#streetpanel')?.dataset.thumbs, cov: document.querySelector('#streetpanel')?.dataset.coverage }));
console.log('street', JSON.stringify(st));
await p.evaluate(() => document.querySelector('#streetpanel')?.scrollIntoView({ block: 'nearest' }));
await p.waitForTimeout(1500); await rec(0.3);
const sMax = await p.evaluate(() => { const s = document.querySelector('.side'); const r = document.querySelector('#streetpanel')?.getBoundingClientRect(); return r ? Math.max(0, s.scrollTop + r.top - 560) : s.scrollHeight; });
await scrollTo(sMax, 1.2); await rec(spec.holdStreet ?? 2.4); mark('street-photos');
// 4. tilt a little lower (the real slider), along the ground
const t1 = spec.tiltTo ?? 76;
await p.evaluate(() => document.querySelector('.side').scrollTo(0, 0)); await rec(0.2);
await p.evaluate(() => document.querySelector('#tilt')?.scrollIntoView({ block: 'center' })); await rec(0.2);
const t0 = await p.evaluate(() => Number(document.querySelector('#tilt').value));
await rec(spec.tiltSecs ?? 2.4, (u) => p.evaluate(([a, c, k]) => { const e = document.querySelector('#tilt'); e.value = String(Math.round(a + (c - a) * k * k * (3 - 2 * k))); e.dispatchEvent(new Event('input', { bubbles: true })); }, [t0, t1, u]));
await rec(1.0); mark('tilt-low');
console.log('pitch', await p.evaluate(() => document.documentElement.dataset.mapPitch));
// 5. send it to the World Editor (the real button) and let the editor load
await p.evaluate(() => document.querySelector('#buildpieces')?.scrollIntoView({ block: 'center' })); await rec(0.6);
await p.click('#buildpieces'); mark('send');
for (let i = 0; i < 20; i++) { await tick(); await shot(); }
await until(() => /mode=editor/.test(location.search) && document.documentElement.dataset.ready === 'true', 'editor', 120000);
await rec(spec.editorHold ?? 3.0); mark('editor');
writeFileSync(`${out}/marks.json`, JSON.stringify({ fps, frames: n, marks, lane, street: st }, null, 2));
console.log('frames', n);
await b.close();
