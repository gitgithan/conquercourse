// Calls the preview's test function (no database) and saves every answer (CC-169). Usage: node run-remote.mjs <base url>
import { readFileSync, writeFileSync } from 'node:fs';
const base = process.argv[2];
const logs = JSON.parse(readFileSync(new URL('./inputs/logs.json', import.meta.url), 'utf8'));
const get = (k) => logs.find((l) => l.key === k);
const res = [];
async function call(group, label, key, extra = {}, n = 3) {
  for (let i = 0; i < n; i++) {
    const t = Date.now();
    let r, text;
    try { r = await fetch(`${base}/api/_cpu-test`, { method: 'POST', body: JSON.stringify({ key, keys: get(key).keys, ...extra }) }); text = await r.text(); }
    catch (e) { text = 'FETCH ERROR ' + e.message; }
    const row = { group, label, key, ...extra, rep: i + 1, status: r?.status ?? 0, roundTripMs: Date.now() - t, cfRay: r?.headers.get('cf-ray'), body: text.slice(0, 400) };
    res.push(row); console.log(group, label, i + 1, row.status, row.roundTripMs + 'ms', row.body.slice(0, 160).replace(/\s+/g, ' '));
  }
}
const T = 'demo/training', G = 'demo/generated-1';
for (const k of ['demo/stack', 'demo/cannon', 'demo/lane-1', 'experiments/osm/montmartre-paris']) await call('1-short', k, k);
await call('2-longest', 'generated-1 27.4s', G); await call('2-longest', 'training 26.9s', T);
const base3233 = 3233;
for (const s of [10, 20, 40, 80, 120]) { const total = s * 120; const idle = Math.max(0, total - base3233); await call('3-idle', `${s}s total (idle ${idle})`, T, { idle }); }
for (const rep of [2, 4, 8, 16, 32, 64]) await call('3-work', `training x${rep} (${(rep * 26.9).toFixed(0)}s of real running)`, T, { repeat: rep });
writeFileSync(new URL('./outputs/remote-results.json', import.meta.url), JSON.stringify({ base, when: new Date().toISOString(), results: res }, null, 2));
