// Heavy calls spaced 25 s apart, each followed at once by a normal 27 s clear, to see whether the cut is per request or per busy Worker (CC-169).
import { readFileSync, writeFileSync } from 'node:fs';
const base = process.argv[2];
const keys = JSON.parse(readFileSync(new URL('./inputs/logs.json', import.meta.url), 'utf8')).find((l) => l.key === 'demo/training').keys;
const rows = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function call(repeat) {
  const t = Date.now();
  const r = await fetch(`${base}/api/_cpu-test`, { method: 'POST', body: JSON.stringify({ key: 'demo/training', keys, repeat }) });
  const text = await r.text();
  return { repeat, status: r.status, roundTripMs: Date.now() - t, body: r.status === 200 ? text : (text.match(/Error \d+/)?.[0] ?? '') + ' ' + (text.match(/<title>([^<]*)/)?.[1]?.trim() ?? '') };
}
for (const repeat of [32, 64, 128, 256]) for (let i = 1; i <= 3; i++) {
  const heavy = await call(repeat), after = await call(1);
  rows.push({ rep: i, heavy, afterNormal: after }); console.log(repeat, i, heavy.status, heavy.roundTripMs + 'ms', '| next normal clear:', after.status, after.roundTripMs + 'ms');
  await sleep(25000);
}
writeFileSync(new URL('./outputs/spaced-results.json', import.meta.url), JSON.stringify({ base, when: new Date().toISOString(), rows }, null, 2));
