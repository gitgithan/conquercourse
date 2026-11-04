// CC-133: the monkey bars on the stepped clock: the Q/T keys card, the hint, the debug rungs and the camera tilting with the swing.
// Usage: node scripts/cc133-bars-camera-shots.mjs [--base http://localhost:5173] [--out test-results/cc133-bars-camera]
import { Shot, arg } from './film-lib.mjs';
const base = arg('base', 'http://127.0.0.1:5173'), out = arg('out', 'test-results/cc133-bars-camera');
const ready = (p) => p.waitForSelector('html[data-ready=true]', { timeout: 240000 });
const shot = new Shot({ name: 'bars', outDir: out, fps: 30, width: 1280, height: 720 });
const page = await shot.open(`${base}/?course=/assets/demo/bars-lift.course.json&welcome=0&bot=ideal&debug=1`, { cursor: false, noTransitions: false, waitReady: ready });
shot.sub = 2;
let bars = 0, n = 0;
for (let i = 0; i < 30 * 40 && n < 4; i++) {
  await shot.step(1000 / 30);
  const m = await page.evaluate(() => document.documentElement.dataset.mode);
  if (m === 'bars') bars++;
  if (bars > 0 && bars % 40 === 1 && m === 'bars') { await shot.grab({ expectMotion: false }); n++; bars++; }
}
await shot.close();
process.exit(0);
