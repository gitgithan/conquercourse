// Pushes the work up until Cloudflare cuts the request, and saves the full error page (CC-169). Usage: node probe.mjs <base url>
import { readFileSync, writeFileSync } from 'node:fs';
const base = process.argv[2];
const logs = JSON.parse(readFileSync(new URL('./inputs/logs.json', import.meta.url), 'utf8'));
const keys = logs.find((l) => l.key === 'demo/training').keys;
const rows = [];
for (const repeat of [1, 8, 16, 24, 32, 48, 64, 96, 128, 192, 256, 512]) for (let i = 1; i <= 5; i++) {
  const t = Date.now();
  const r = await fetch(`${base}/api/_cpu-test`, { method: 'POST', body: JSON.stringify({ key: 'demo/training', keys, repeat }) });
  const text = await r.text();
  const row = { repeat, totalTicks: repeat * 3233, rep: i, status: r.status, roundTripMs: Date.now() - t, headers: Object.fromEntries([...r.headers].filter(([k]) => /^(cf-|server|content-type)/.test(k))), body: text.length > 600 ? text : text };
  rows.push(row); console.log(repeat, i, r.status, row.roundTripMs + 'ms', text.slice(0, 80).replace(/\s+/g, ' '));
}
writeFileSync(new URL('./outputs/probe-results.json', import.meta.url), JSON.stringify({ base, when: new Date().toISOString(), rows }, null, 2));
