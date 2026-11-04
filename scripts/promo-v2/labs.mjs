// Promo v2 segment: the Labs button opens the mind map; hover Video to motion (the other Labs dim); open Posing a character and slide how crouched the body is.
// usage: node labs.mjs <playwright> <outdir> [params.json] [baseUrl]
import { readFileSync } from 'node:fs';
import { openSession } from './lib.mjs';
const [pw, out, pfile, base = 'http://localhost:5173'] = process.argv.slice(2);
const P = JSON.parse(readFileSync(pfile || new URL('./params/labs.json', import.meta.url), 'utf8'));
const S = await openSession({ url: null, out, pw }); const p = S.p;
await p.goto(base + P.startUrl);
await p.waitForSelector('#labs-open', { timeout: 90000 }); await S.settle(4000); await S.hideChrome();
// 1. the Labs button opens the mind map: grouped boxes, icons, dependency lines
await S.glideTo('#labs-open', 0.7); await S.rec(0.2);
await p.click('#labs-open'); await S.rec(P.holdMap); S.marks.map = S.n / S.fps;
// 2. hover Video to motion: the other Labs dim
const tile = (name) => p.locator('.lp-tile', { hasText: name }).first();
let bb = await tile(P.hoverTile).boundingBox(); await S.glide(bb.x + bb.width / 2, bb.y + bb.height / 2, 0.9);
await S.rec(P.hoverHold); S.marks.hover = S.n / S.fps;
// 3. go to Posing a character
bb = await tile(P.poseTile).boundingBox(); await S.glide(bb.x + bb.width / 2, bb.y + bb.height / 2, 0.8); await S.rec(0.5);
await p.click('.lp-tile >> text=' + P.poseTile); S.marks.click = S.n / S.fps;
await p.waitForSelector('#ik-pic', { timeout: 60000 }); await S.settle(3000); await S.hideChrome();
// the crouch slider and the Rookie in one view
await p.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center' }), P.slider); await S.rec(0.6);
S.marks.pose = S.n / S.fps;
await S.glideTo(P.slider, 0.6);
await S.slide(P.slider, P.sliderLow, P.sliderSecs); await S.rec(0.3);
await S.slide(P.slider, P.sliderHigh, P.sliderSecs); await S.rec(0.5); S.marks.slider = S.n / S.fps;
await S.finish({ params: P });
