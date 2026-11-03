// CC-133 browser run: the monkey bars made from the Saienji lift, on the stepped clock at 1280 x 720 (desktop only).
// Usage: node scripts/cc133-bars-lift-shots.mjs [--base http://localhost:5173] [--out test-results/cc133-bars-lift] [--film 1]
// Pictures: the course with the photo skin alone, and with the amber collider drawn over it (?collider=1). Film: the ghost / ideal run swinging along the rungs.
// Every kept frame is one 1/30 s step of the game clock, so the film plays at the game clock without retiming.
import { Shot, arg } from './film-lib.mjs';
const base = arg('base', 'http://127.0.0.1:5173'), out = arg('out', 'test-results/cc133-bars-lift'), film = arg('film', '1') === '1';
const url = (extra) => `${base}/?course=/assets/demo/bars-lift.course.json&welcome=0${extra}`;
const ready = (p) => p.waitForSelector('html[data-ready=true]', { timeout: 240000 });
const modeOf = (p) => p.evaluate(() => [document.documentElement.dataset.mode, document.documentElement.dataset.outcome]);
// Stills: the ideal run hangs on the rungs; take the picture a moment after the first grab.
for (const [name, extra] of [['skin', ''], ['collider', '&collider=1']]) {
  const shot = new Shot({ name, outDir: out, fps: 30, width: 1280, height: 720 });
  const page = await shot.open(url('&bot=ideal&ghost=bot' + extra), { cursor: false, noTransitions: false, waitReady: ready });
  shot.sub = 2;
  let bars = 0;
  for (let i = 0; i < 30 * 40 && bars < 45; i++) { await shot.step(1000 / 30); if ((await modeOf(page))[0] === 'bars') bars++; }
  await shot.grab({ expectMotion: false });
  await shot.close();
}
if (film) {
  const shot = new Shot({ name: 'film', outDir: out, fps: 30, width: 1280, height: 720 });
  const page = await shot.open(url('&bot=ideal&ghost=bot'), { cursor: false, noTransitions: false, waitReady: ready });
  shot.sub = 2;
  let bars = 0, after = 0;
  for (let i = 0; i < 30 * 40; i++) {
    await shot.step(1000 / 30);
    const [m, o] = await page.evaluate(() => [document.documentElement.dataset.mode, document.documentElement.dataset.outcome]);
    if (m === 'bars') bars++;
    if (bars === 1) shot.mark('bars grabbed');
    await shot.grab();
    if (bars > 0 && m !== 'bars' && ++after > 45) break;
    if (o && o !== 'running') { for (let k = 0; k < 30; k++) { await shot.step(1000 / 30); await shot.grab(); } break; }
  }
  await shot.close();
}
process.exit(0);
