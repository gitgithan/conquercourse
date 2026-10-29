// Warms the site's place cache before the demo (CC-152): asks /api/places once for each place, so a pin there answers from the cache.
// Usage: node scripts/warm-places.mjs <base url> [list.json]     e.g. node scripts/warm-places.mjs https://conquercourse.pages.dev
// The cache is the Cloudflare Cache API of the data centre that answers THIS request, so run it from the machine and the network the demo will be played from.
// The function lets one address start 20 new places in ten minutes (cache hits are free), so a miss is followed by a 31 s pause.
import { readFileSync } from 'node:fs';
const [base, listFile] = process.argv.slice(2);
if (!base) { console.error('Usage: node scripts/warm-places.mjs <base url> [list.json]'); process.exit(1); }
const places = JSON.parse(readFileSync(listFile ?? new URL('./warm-places.json', import.meta.url), 'utf8'));
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
let hits = 0, misses = 0, failed = 0;
for (const p of places) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${base}/api/places?lat=${p.lat}&lon=${p.lon}&r=${p.radius ?? 120}`, { signal: AbortSignal.timeout(60000) });
    const j = await res.json().catch(() => ({}));
    const ms = Date.now() - t0;
    if (res.ok && j.cache === 'hit') { hits++; console.log(`hit   ${p.name} ${ms} ms`); }
    else if (res.ok) { misses++; console.log(`miss  ${p.name} ${ms} ms (${j.source}, ${j.elements?.length} elements)`); await pause(31000); }
    else { failed++; console.log(`FAIL  ${p.name} HTTP ${res.status} ${j.error ?? ''}`); await pause(res.status === 429 ? 120000 : 5000); }
  } catch (e) { failed++; console.log(`FAIL  ${p.name} ${e.message}`); await pause(5000); }
}
console.log(`done: ${hits} already warm, ${misses} warmed now, ${failed} failed`);
process.exit(failed ? 1 : 0);
