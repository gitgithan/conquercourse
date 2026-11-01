// CC-143 film shot 2 (v3): a plain screen recording: a short World Slicer part, then a slow World Editor part. No overlay, no camera jumps, no edits.
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
const total = Math.round((spec.totalSecs ?? 21.6) * fps); // the film clip: a whole number of bars (2.4 s each)
const ease = (k) => k * k * (3 - 2 * k);
const rec = async (sec, each) => { const k = Math.round(sec * fps); for (let i = 0; i < k; i++) { if (each) await each(i / Math.max(1, k - 1)); await tick(); await shot(); } };
const until = async (fn, label, ms = 120000, record = false) => { const t0 = Date.now(); for (;;) { if (await p.evaluate(fn).catch(() => false)) return true; if (Date.now() - t0 > ms) { console.log('timeout', label); return false; } await tick(); if (record) await shot(); await p.waitForTimeout(60); } };
const mark = (k) => { marks[k] = n / fps; console.log('mark', k, marks[k].toFixed(2)); };

await p.goto(spec.url);
await until(() => !!window.__ccMap && document.documentElement.dataset.mapready !== undefined || !!document.querySelector('#slice'), 'load');
await until(() => document.documentElement.dataset.mapready === '1' || !!document.querySelector('.maplibregl-canvas'), 'map');
await p.addStyleTag({ content: '#cc-feedback-btn{display:none!important}' });

await rec(spec.holdStart ?? 0.6); mark('top-view');
// 1. choose the place by clicking its picture card; the map jumps once on that click, so the film clip starts on the picture after the jump
await p.locator(`.side >> text=${spec.place}`).first().click();
// the map flies from the whole country to the place: let that finish with the clock moving and no pictures taken
for (let i = 0; i < 100; i++) { await tick(); await p.waitForTimeout(40); }
marks.clipStart = n / fps; const clipStart = n;
await rec(spec.afterPlace ?? 0.4); mark('place-chosen');
// 2. slice: the real flight (top view -> buildings rise -> low side camera) plays by itself
await p.click('#slice'); mark('slice');
await until(() => document.documentElement.dataset.flightDone === '1' || !!document.querySelector('[data-flight-done="1"]'), 'flight', 400000, true);
await rec(spec.afterFlight ?? 0.2); mark('flight-done');
const lane = await p.evaluate(() => document.querySelector('[data-slice-lane]')?.getAttribute('data-slice-lane'));
console.log('lane', lane);
// 3. a short, quick pass over the side panel: the cut-height strip, then the street photos
const scrollTo = (to, sec) => p.evaluate(() => document.querySelector('.side').scrollTop).then((from) => rec(sec, (u) => p.evaluate(([f, t, k]) => { document.querySelector('.side').scrollTop = f + (t - f) * (k * k * (3 - 2 * k)); }, [from, to, u])));
await scrollTo(spec.scrollCut ?? 760, 0.7); await rec(spec.holdCut ?? 0.8); mark('cut-strip');
await until(() => { const e = document.querySelector('#streetpanel'); return !!e && /^[1-9]/.test(e.dataset.thumbs || '') || e?.dataset.thumbs === 'failed'; }, 'street-thumbs', 90000);
const st = await p.evaluate(() => ({ thumbs: document.querySelector('#streetpanel')?.dataset.thumbs, cov: document.querySelector('#streetpanel')?.dataset.coverage }));
console.log('street', JSON.stringify(st));
await p.evaluate(() => document.querySelector('#streetpanel')?.scrollIntoView({ block: 'nearest' }));
await p.waitForTimeout(1500); await rec(0.1);
const sMax = await p.evaluate(() => { const s = document.querySelector('.side'); const r = document.querySelector('#streetpanel')?.getBoundingClientRect(); return r ? Math.max(0, s.scrollTop + r.top - 560) : s.scrollHeight; });
await scrollTo(sMax, 0.7); await rec(spec.holdStreet ?? 0.8); mark('street-photos');
// 4. tilt a little lower (the real slider), along the ground
const t1 = spec.tiltTo ?? 76;
await p.evaluate(() => document.querySelector('.side').scrollTo(0, 0)); await rec(0.1);
await p.evaluate(() => document.querySelector('#tilt')?.scrollIntoView({ block: 'center' })); await rec(0.1);
const t0 = await p.evaluate(() => Number(document.querySelector('#tilt').value));
await rec(spec.tiltSecs ?? 1.2, (u) => p.evaluate(([a, c, k]) => { const e = document.querySelector('#tilt'); e.value = String(Math.round(a + (c - a) * k * k * (3 - 2 * k))); e.dispatchEvent(new Event('input', { bubbles: true })); }, [t0, t1, u]));
await rec(0.3); mark('tilt-low');
console.log('pitch', await p.evaluate(() => document.documentElement.dataset.mapPitch));
// 5. send it to the World Editor (the real button); no pictures while the editor loads (the film cuts from the Send button to the loaded editor)
await p.evaluate(() => document.querySelector('#buildpieces')?.scrollIntoView({ block: 'center' })); await rec(0.3);
await p.click('#buildpieces'); mark('send');
await until(() => /mode=editor/.test(location.search) && document.documentElement.dataset.ready === 'true', 'editor', 120000);
await p.waitForTimeout(2500);
// the first-visit help box would cover the picture: close it (its own Hide button), and keep the Design partner panel closed
await p.evaluate(() => { for (const b of document.querySelectorAll('button')) if (b.textContent.trim() === 'Hide' && b.closest('div')?.textContent?.includes('What these buttons do')) b.click(); });
for (let i = 0; i < 6; i++) await tick();
// 6. the World Editor, slow and steady: eased mouse moves only, one picture per step
const box = await p.evaluate(() => { const r = document.querySelector('#view3d').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
let mx = box.x + box.w * 0.5, my = box.y + 70; await p.mouse.move(mx, my);
const glide = async (x1, y1, sec, down) => { const x0 = mx, y0 = my; await rec(sec, async (u) => { await p.mouse.move(x0 + (x1 - x0) * ease(u), y0 + (y1 - y0) * ease(u)); }); mx = x1; my = y1; };
const orbit = async (dx, dy, sec, button = 'left') => { const x0 = mx, y0 = my; await p.mouse.down({ button }); await rec(sec, async (u) => { await p.mouse.move(x0 + dx * ease(u), y0 + dy * ease(u)); }); await p.mouse.up({ button }); mx = x0 + dx; my = y0 + dy; };
await rec(0.5); mark('editor');
await orbit(spec.orbit1 ?? 280, 0, spec.orbit1Secs ?? 2.0); mark('orbit-1');       // a gentle turn around the lane
await rec(0.3);
const addBtn = await p.locator('#addpiece').boundingBox();
await glide(addBtn.x + addBtn.width / 2, addBtn.y + addBtn.height / 2, 0.7);
await p.click('#addpiece'); await rec(1.0); mark('piece-list');                       // the list of real objects opens: hold so it can be read
// the course already holds the editor's most pieces (30), so no new one can be added: show the list itself, slowly, card by card, then its by-move view
const card = async (label, sec) => { const bb = await p.locator('.addmenu.open button', { hasText: label }).first().boundingBox(); await glide(bb.x + bb.width / 2, bb.y + bb.height / 2, sec); };
await card('Fire hydrant', 0.7); await rec(0.2);
await card('Picnic table', 0.6); await rec(0.2);
const tab = await p.locator('#pbbymove').boundingBox(); await glide(tab.x + tab.width / 2, tab.y + tab.height / 2, 0.6);
await p.click('#pbbymove'); await rec(1.0); mark('by-move');                           // the same real objects, grouped by the move that gets a player past them
await p.click('#addpiece'); await rec(0.2); mark('piece-added');                       // close the list
await glide(box.x + box.w * 0.5, box.y + 70, 0.3);
const rem = total - (n - clipStart);
console.log('frames left for the last slow turn', rem);
if (rem > 0) await orbit(spec.orbit2 ?? -300, 0, rem / fps);                           // the last, slowest turn
mark('end');
writeFileSync(`${out}/marks.json`, JSON.stringify({ fps, frames: n, clipStart, clipFrames: n - clipStart, marks, lane, street: st }, null, 2));
console.log('frames', n, 'clip', n - clipStart);
await b.close();
