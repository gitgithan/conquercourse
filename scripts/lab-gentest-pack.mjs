// Packs the recorded Muse Spark Open course proposals (data/eval/cc-122-bulk-courses/results.json) into the small file the Generate and test Lab ships.
// Usage: node scripts/lab-gentest-pack.mjs      Writes public/assets/lab/gentest-proposals.json (pretty-printed). No model call.
import { readFileSync, writeFileSync } from 'node:fs';
const src = JSON.parse(readFileSync('data/eval/cc-122-bulk-courses/results.json', 'utf8'));
const proposals = src.rows.map((r) => ({
  id: `m${String(r.index).padStart(3, '0')}`,
  theme: r.theme,
  level: r.level,
  layout: r.layout ? { items: r.layout } : null,
  recordedClear: r.layout ? Boolean(r.clearsAsDrawn) : false,
}));
const out = { about: 'Recorded replies of meta-models/muse-spark-open-1026 asked for a course idea (CC-122). The Lab replays them; it makes no model call.', asked: src.summary.asked, proposals };
writeFileSync('public/assets/lab/gentest-proposals.json', JSON.stringify(out, null, 2) + '\n');
console.log(proposals.length, 'proposals;', proposals.filter((p) => p.layout).length, 'readable;', proposals.filter((p) => p.recordedClear).length, 'recorded as clearing');
