// CC-133 browser check: the ghost is posed like the player (hanging on the rungs, on the rope, vaulting), on the stepped clock at 1280 x 720.
// Usage: node scripts/ghost-pose-check.mjs [--base http://localhost:5173] [--out test-results/ghost-pose]
// For each course it plays the bot (?bot=ideal&ghost=bot) until the world reaches the mode, then keeps frames a little apart (the ghost is the amber figure).
import { Shot, arg } from './film-lib.mjs';
import { writeFileSync } from 'node:fs';
const base = arg('base', 'http://localhost:5173'), out = arg('out', 'test-results/ghost-pose');
const only = arg('only', ''), cases = [['bars', 'bars', 'bars'], ['swing-to-bars', 'swing-to-bars', 'bars'], ['lache', 'lache', 'hang'], ['training', 'training', 'vault'], ['lache-wide', 'lache-wide', 'hang']].filter((c) => !only || only.split(',').includes(c[0]));
const summary = [];
for (const [name, course, mode] of cases) {
  const shot = new Shot({ name, outDir: out, fps: 30, width: 1280, height: 720 });
  const page = await shot.open(`${base}/?course=/assets/demo/${course}.course.json&bot=ideal&ghost=bot&welcome=0`, { cursor: false, noTransitions: false, waitReady: (p) => p.waitForSelector('html[data-ready=true]', { timeout: 240000 }) });
  shot.sub = 2;
  const ghost = await page.evaluate(() => document.querySelector('#ghost-chip')?.textContent ?? '');
  let seen = 0, kept = 0, modes = new Set();
  for (let i = 0; i < 30 * 120 && kept < 6; i++) {
    await shot.step(1000 / 30);
    const m = await page.evaluate(() => document.documentElement.dataset.mode);
    modes.add(m);
    if (m === mode) { if (seen % 10 === 0) { await shot.grab(); kept++; } seen++; }
    const o = await page.evaluate(() => document.documentElement.dataset.outcome);
    if (o && o !== 'running') break;
  }
  summary.push({ name, mode, kept, ghost, modes: [...modes] });
  console.log(name, mode, 'kept', kept, [...modes].join(','));
  await shot.close();
}
writeFileSync(`${out}/summary-${only || 'all'}.json`, JSON.stringify(summary, null, 2) + '\n');
process.exit(0);
