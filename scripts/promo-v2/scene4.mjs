// Promo storyboard scene 4 (CC-133): Run, share and learn on the fork-bench-bulb course, by hand (real keys, no bot).
// usage: node scene4.mjs <dry|publish> <playwright> <outdir> [baseUrl]
//   dry: every step but the click on Publish (and the pre-publish steps work on any server); publish: ONE MetaHackathon publish (use the preview site).
// The keys are the stored bulb-lane line of the course (params/scene4-bulb-keys.json), pressed as a person would (D run, S crouch, E hold), one game tick at a time on the stepped clock.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { openSession } from './lib.mjs';
const [mode, pw, out, base = 'http://localhost:5173'] = process.argv.slice(2);
const K = JSON.parse(readFileSync(new URL('./params/scene4-bulb-keys.json', import.meta.url), 'utf8'));
const LAG = Number(process.env.LAG ?? 90);              // ticks (120 a second) the ghost is ahead
const NAME = 'MetaHackathon';
const URL_ = '/?course=/assets/demo/fork-bench-bulb.course.json&welcome=0&backend=webgl2&sunat=noon';
const S = await openSession({ url: null, out, pw, rafStep: true }); const p = S.p;
mkdirSync(`${out}/debug`, { recursive: true });
await p.addInitScript(() => { try { localStorage.setItem('cc.next.seen', '1'); } catch { /* ok */ } });
const log = (...a) => console.log('S4', ...a);
const dbg = async (n) => { await p.screenshot({ path: `${out}/debug/${n}.png`, timeout: 60000 }).catch(() => {}); };
const step = async (fn, label) => { try { await fn(); } catch (e) { log('STEP FAILED', label, String(e).slice(0, 200)); await dbg('fail-' + label); } };

await p.goto(base + URL_);
await p.waitForSelector('html[data-ready=true]', { timeout: 240000 });
await S.settle(2500); await S.hideChrome();
await p.keyboard.press('KeyH').catch(() => {});                   // Controls card off
await p.mouse.move(640, 700); S.mx = 640; S.my = 700;
const ghostChip = () => p.evaluate(() => document.querySelector('#ghost-chip')?.textContent ?? 'none');
for (let i = 0; i < 6 && !/Ghost: (?!working|Off|no )/.test(await ghostChip()); i++) { log('ghost chip', await ghostChip()); await S.until(() => /Ghost: (?!working|Off|no )/.test(document.querySelector('#ghost-chip')?.textContent ?? ''), 'ghost', 20000); if (i == 2) await p.keyboard.press('KeyN'); }
log('ghost chip', await ghostChip());
await dbg('0-ready');

// ---- the run, tick by tick -------------------------------------------------------------------------------------------------------
const per = []; for (const [m, n] of K.log) for (let i = 0; i < n; i++) per.push(m);
const B = Object.fromEntries(K.bits.map((b, i) => [b, 1 << i]));
const held = new Set();
const want = async (code, on) => { if (on && !held.has(code)) { held.add(code); await p.keyboard.down(code); } else if (!on && held.has(code)) { held.delete(code); await p.keyboard.up(code); } };
const STEP_MS = 1000 / 120 + 0.0005;
const stepOne = () => p.evaluate((ms) => { window.__stepClock(ms); return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(Number(document.documentElement.dataset.tick || 0))))); }, STEP_MS);
let tick = Number(await p.evaluate(() => document.documentElement.dataset.tick || 0)); const t0 = tick;
log('start tick', t0);
S.mark('start');
let frameAt = 0, missed = 0;
const pressed = {};
while (tick - t0 < per.length + LAG) {
  const idx = tick - t0 - LAG, m = idx >= 0 ? per[idx] : 0;
  await want('KeyD', !!(m & B.run)); await want('KeyS', !!(m & B.squat)); await want('KeyE', !!(m & (B.handL | B.handR)));
  const nt = await stepOne(); if (nt !== tick + 1) missed++; tick = nt;
  if (tick - t0 >= frameAt) { await S.shot(); frameAt += 4; }
  if (idx === 190 && !pressed.pole) { pressed.pole = 1; S.mark('pole'); }
  if (idx === 456 && !pressed.bars) { pressed.bars = 1; S.mark('bars'); }
  if (idx === 1100 && !pressed.drop) { pressed.drop = 1; S.mark('drop'); }
  const oc = await p.evaluate(() => document.documentElement.dataset.outcome);
  if (oc && oc !== 'running') { log('outcome', oc, 'at tick', tick - t0); break; }
}
for (const c of [...held]) await want(c, false);
log('run done, ticks', tick - t0, 'missed steps', missed, 'x', await p.evaluate(() => window.__filmRunner?.x ?? null));
S.mark('cleared');
await S.until(() => !!document.querySelector('#report-publish') || !!document.querySelector('#report-actions'), 'report', 40000, true);
await S.rec(0.5); await dbg('1-report');
S.mark('report');
log('report ids', JSON.stringify(await p.evaluate(() => ['report-publish', 'publish-nick', 'publish-board', 'report-board', 'share-copy', 'share-clip', 'report-watch', 'report-again'].map((i) => [i, !!document.getElementById(i)]))));

// ---- Share your achievements ------------------------------------------------------------------------------------------------------
await step(async () => {
  await S.clickSel('#publish-nick', { move: 0.7, hold: 0.25, after: 0.2 });
  for (const ch of NAME) { await p.keyboard.type(ch); await S.rec(0.07); }
  log('nick field', await p.evaluate(() => document.querySelector('#publish-nick').value));
  await S.rec(0.3); S.mark('typed'); await dbg('2-typed');
}, 'type');
await step(async () => {
  const label = await p.evaluate(() => document.querySelector('#publish-board')?.textContent);
  log('publish button', label);
  if (mode === 'publish') {
    await S.clickSel('#publish-board', { move: 0.6, hold: 0.3, after: 0.1 }); S.mark('publish');
    await S.until(() => /Published/.test(document.querySelector('#publish-board')?.textContent ?? ''), 'published', 60000, true);
    log('after publish', await p.evaluate(() => document.querySelector('#publish-board')?.textContent + ' | ' + (document.querySelector('#publish-result')?.textContent ?? '')));
  } else { await S.glideTo('#publish-board', 0.6); await S.rec(0.4); log('dry: not clicking Publish'); }
  S.mark('published');
}, 'publish');
await step(async () => {
  // highlight the new row: a yellow frame round it (the game already gives it a green edge and "(you)")
  const found = await p.evaluate(() => { const r = [...document.querySelectorAll('.board-row')].find((x) => /\(you\)/.test(x.textContent ?? '')); if (!r) return false; r.scrollIntoView({ block: 'center' }); r.style.outline = '5px solid #ffd400'; r.style.outlineOffset = '2px'; r.style.background = '#fff6c2'; return true; });
  log('row found', found);
  await S.rec(1.5); await dbg('3-row'); S.mark('rowShown');
}, 'row');

// ---- Challenge your friend --------------------------------------------------------------------------------------------------------
await step(async () => {
  await p.evaluate(() => document.querySelector('#share-copy')?.scrollIntoView({ block: 'center' })); await S.rec(0.2);
  await S.glideTo('#share-copy', 0.7); await S.rec(0.4);
  await S.clickSel('#share-copy', { move: 0, hold: 0.25, after: 0.9 }); S.mark('copy'); await dbg('4-copy');
}, 'copy');

// ---- Watch yourself or the simulator ----------------------------------------------------------------------------------------------
await step(async () => {
  await S.glideTo('#share-clip', 0.7); await S.rec(1.0); S.mark('clipPoint'); await dbg('5-clip');
}, 'clip');
await step(async () => {
  await p.evaluate(() => document.querySelector('#report-watch')?.scrollIntoView({ block: 'center' })); await S.rec(0.3);
  await S.clickSel('#report-watch', { move: 0.8, hold: 0.25, after: 0 }); S.mark('watch');
  await S.rec(6.0); S.mark('end'); await dbg('6-watch');
}, 'watch');
await S.finish({ mode, lag: LAG, ticks: tick - t0, missed });
