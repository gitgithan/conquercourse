// Promo storyboard scene 5 (CC-133): Unleash your creativity, five 2 s shots of the shipped obstacles driven by the ideal-line bot.
// usage: node scene5.mjs <cannon|coaster|drone|pole|trebuchet> <playwright> <outdir> [baseUrl]
// env S5_SCAN=1 : scan mode, one small picture per 0.5 game s for 30 s (to pick the window); env S5_SKIP=<game s>, S5_CAM=first|side, S5_RATE=<game s per film s> override the table.
import { readFileSync, writeFileSync } from 'node:fs';
import { openSession, retime } from './lib.mjs';
const [which, pw, out, base = 'http://localhost:5173'] = process.argv.slice(2);
const T = JSON.parse(readFileSync(new URL('./params/scene5.json', import.meta.url), 'utf8'));
const A = { ...T[which], ...(process.env.S5_SKIP ? { skip: Number(process.env.S5_SKIP) } : {}), ...(process.env.S5_RATE ? { rate: Number(process.env.S5_RATE) } : {}) };
const cam = process.env.S5_CAM ?? A.cam;
const S = await openSession({ url: null, out, pw, rafStep: true }); const p = S.p;
await p.addInitScript(() => { try { localStorage.setItem('cc.next.seen', '1'); } catch { /* ok */ } });
await p.goto(base + A.url + (cam === 'first' ? '&cam=first' : ''));
await p.waitForSelector('html[data-ready=true]', { timeout: 240000 });
await p.waitForTimeout(2500); await S.hideChrome();   // real waits: the game clock must not move before the film starts
await p.keyboard.press('KeyH').catch(() => {});
if (A.keys) for (const k of A.keys) await p.keyboard.press(k);
await p.waitForTimeout(600);
const hud = () => p.evaluate(() => (window.__filmRunner ? JSON.stringify(window.__filmRunner) : ''));
if (process.env.S5_SCAN) {
  S.dt = 500;
  for (let i = 0; i < 60; i++) { await S.tick(); await S.shot(); if (i % 4 === 0) console.log('t', i * 0.5, await hud()); }
  await S.finish({ scan: true, params: A }); process.exit(0);
}
// pole: no ideal line exists, so the keys are ours (checked in the simulator: E from 1 m before the pole, let go 0.65 s after the box)
const chipX = () => p.evaluate(() => Number((document.body.innerText.match(/Time [\d.]+ s\D+?(-?[\d.]+) m of/) ?? [])[1] ?? 0));
let pk = { run: false, e: false, planted: null };
const poleKeys = async () => {
  const x = await chipX(), t = pk.t ?? 0;
  if (!pk.run) { await p.keyboard.down('ArrowRight'); pk.run = true; }
  if (!pk.e && x >= 4) { await p.keyboard.down('KeyE'); pk.e = true; }
  if (pk.e && pk.planted === null && x >= 36) pk.planted = pk.n;
  if (pk.planted !== null && pk.e && pk.n - pk.planted >= 20) { await p.keyboard.up('KeyE'); pk.e = false; pk.done = true; }
  pk.n++;
};
pk.n = 0;
// skip: run the game forward with no pictures
const stepMs = 1000 / S.fps; let g = 0;
if (which === 'pole') { for (let i = 0; i < 1800 && (await chipX()) < A.untilX; i++) { await poleKeys(); await S.tick(stepMs); if (i % 60 === 0) console.log('pole x', await chipX(), 'i', i); } }
else while (g < A.skip) { await S.tick(stepMs); g += stepMs / 1000; if (Math.round(g * 30) % 15 === 0) await p.waitForTimeout(5); }
S.dt = stepMs * (A.rate ?? 1);
S.mark('start');
await S.rec(2, which === 'pole' ? poleKeys : undefined);
S.mark('end');
await S.finish({ params: A, cam });
retime(out, `${out}/clip.mp4`, { k: 1 });
console.log('done');
