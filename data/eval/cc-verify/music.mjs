// CC-186 (6): the Course screen fetches /assets/music/course.ogg and loops it past its own length with no error and no 'ended' event.
import { launch, ok, save, shot, base } from './lib.mjs';
const b = await launch();
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [], got = [];
page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
page.on('response', (r) => { if (r.url().includes('/assets/music/')) got.push(r.url().split('/').pop() + ':' + r.status()); });
await page.addInitScript(() => {
  window.__mus = { srcs: [], ended: 0, ctx: null };
  const AC = window.AudioContext;
  window.AudioContext = class extends AC { constructor(...a) { super(...a); window.__mus.ctx = this; const cb = this.createBufferSource.bind(this); this.createBufferSource = () => { const s = cb(); window.__mus.srcs.push(s); s.addEventListener('ended', () => window.__mus.ended++); return s; }; } };
});
await page.goto(`${base}/?music=1&welcome=0&tour=0`, { waitUntil: 'load' });
await page.waitForSelector('html[data-ready=true]', { timeout: 180000 });
await page.keyboard.press('Shift'); // a gesture, in case the browser asked for one
await page.waitForFunction(() => document.documentElement.dataset.music === 'course', null, { timeout: 20000 }).catch(() => {});
const s0 = await page.evaluate(() => ({ music: document.documentElement.dataset.music, t: window.__mus.ctx?.currentTime, state: window.__mus.ctx?.state, n: window.__mus.srcs.length, loop: window.__mus.srcs.map((s) => s.loop), dur: window.__mus.srcs.map((s) => s.buffer?.duration) }));
console.log(JSON.stringify(s0), got.join(','));
ok('6 music', 'Course screen fetched course.ogg (200)', got.includes('course.ogg:200'), got.join(','));
ok('6 music', 'html[data-music] = course', s0.music === 'course', s0.music);
ok('6 music', 'buffer source loops', s0.loop[0] === true, JSON.stringify(s0.loop));
await page.waitForTimeout(Math.ceil((s0.dur[0] ?? 9) * 1000) + 6000); // past the end of the loop at least once
const s1 = await page.evaluate(() => ({ t: window.__mus.ctx?.currentTime, state: window.__mus.ctx?.state, ended: window.__mus.ended, n: window.__mus.srcs.length }));
console.log(JSON.stringify(s1));
await shot(page, 'music-course');
ok('6 music', 'audio clock ran past one loop length and the source never ended', s1.state === 'running' && s1.t - (s0.t ?? 0) > (s0.dur[0] ?? 9) + 3 && s1.ended === 0 && s1.n === 1, `ctx ${s0.t?.toFixed(1)} -> ${s1.t?.toFixed(1)} s, loop ${s0.dur[0]?.toFixed(2)} s, ended ${s1.ended}, sources ${s1.n}, state ${s1.state}`);
ok('6 music', 'no console errors or page errors', errs.length === 0, errs.slice(0, 3).join(' | ').slice(0, 300));
save('run-music.json'); await b.close();
