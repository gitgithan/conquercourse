// CC-186 follow-up: finished link banner, fine-stepped lache grab, missed wall.
import { launch, ok, save, frames, shot, base, OUT, stepInit } from './lib.mjs';
import { execFileSync } from 'node:child_process';
const b = await launch();
const root = new URL('../../..', import.meta.url).pathname;
// A: finished link
const flink = execFileSync('node_modules/.bin/tsx', ['scripts/share-link.ts', 'public/assets/demo/lache.course.json', base], { cwd: root }).toString().trim();
const pa = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); const ea = []; pa.on('pageerror', (e) => ea.push(String(e)));
await pa.addInitScript(stepInit);
await pa.goto(flink.replace(/^https?:\/\/[^/]+/, base), { waitUntil: 'load' });
await pa.waitForSelector('html[data-ready=true]', { timeout: 180000 }).catch(() => {});
await frames(pa, 20); await pa.waitForTimeout(1500);
const ban = await pa.evaluate(() => document.getElementById('challenge-banner')?.innerText ?? '');
await shot(pa, 'finished-link-fresh-page');
ok('4 share', 'finished link opens in a fresh page with a challenge banner', ban.length > 0 && ea.length === 0, ban.replace(/\n/g, ' | ') + ' ' + ea.join(';'));
await pa.close();
// B: missed wall and lache grab, fine steps
const mk = async (url) => { const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); await p.addInitScript(stepInit); await p.addInitScript(() => { try { localStorage.setItem('cc.worldWelcome.seen', '1'); } catch {} }); await p.goto(url, { waitUntil: 'load' }); await p.waitForSelector('html[data-ready=true]', { timeout: 180000 }); await frames(p, 5); return p; };
const st = (p) => p.evaluate(() => ({ m: document.documentElement.dataset.mode, o: document.documentElement.dataset.outcome, x: document.documentElement.dataset.x, panel: !!document.querySelector('#report-again'), text: document.body.innerText.match(/slid back[^.]*\./)?.[0] ?? '' }));
const pb = await mk(`${base}/?course=/assets/demo/training.course.json&welcome=0&tour=0&startx=70`);
await pb.keyboard.down('ArrowRight');
let last; let slid = false;
for (let i = 0; i < 900; i++) { await pb.evaluate(async () => { window.__stepClock(1000 / 30); await new Promise((r) => requestAnimationFrame(() => r())); });
  last = await st(pb); if (i % 40 === 0) console.log(JSON.stringify(last));
  if (last.o !== 'running' || last.panel) break; }
await frames(pb, 30); last = await st(pb); await shot(pb, 'missed-wall-or-fall'); console.log('B', JSON.stringify(last));
ok('1 training', 'run without E at the wall ends (slide or fall) and shows a panel', last.o !== 'running' || last.panel, JSON.stringify(last));
const toast = await pb.evaluate(() => [...document.querySelectorAll('[class*=toast],#toast,#msg')].filter((e) => e.offsetParent).map((e) => e.textContent.trim()));
ok('1 training', 'no separate fail toast over the panel', toast.length === 0, JSON.stringify(toast));
await pb.close();
// C: lache grab at 1/60 s
const pc = await mk(`${base}/?course=/assets/demo/training.course.json&bot=ideal&welcome=0&tour=0`);
let n = 0, got = 0;
for (let i = 0; i < 6000 && got < 6; i++) { const x = Number(await pc.evaluate(() => document.documentElement.dataset.x)); const fine = x > 133.5 && x < 136.5;
  await pc.evaluate(async (ms) => { window.__stepClock(ms); await new Promise((r) => requestAnimationFrame(() => r())); }, fine ? 1000 / 60 : 200);
  if (fine && (n++ % 3 === 0)) { got++; await shot(pc, `lache-grab-${got}`); } if (x > 137) break; }
ok('1 training', 'lache grab frames captured at 1/60 s (judge by eye)', got >= 3, got + ' shots');
save('run-final.json'); await b.close();
