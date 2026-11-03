// Step 1: the real safety check (functions/api/moderate.ts askModeration: Muse Spark Open on Baseten, the same call /api/segment makes first).
// usage: BASETEN_API_KEY=... npx tsx safety_check.ts THUMB.jpg OUT.json   (the key is read from the environment, never printed or saved)
import { readFileSync, writeFileSync } from 'node:fs';
import { askModeration } from '../../../../functions/api/moderate';
const [thumb, out] = process.argv.slice(2);
const image = 'data:image/jpeg;base64,' + readFileSync(thumb).toString('base64');
const t0 = Date.now();
const r = await askModeration(process.env.BASETEN_API_KEY ?? '', { image });
const rec = { model: 'Muse Spark Open (Baseten)', thumb, http_status: r.status, verdict: r.body.verdict, reason: r.body.reason, seconds: (Date.now() - t0) / 1000 };
writeFileSync(out, JSON.stringify(rec, null, 2) + '\n');
console.log(rec);
