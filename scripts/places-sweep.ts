// CC-178: does a lower cut height help? For one place, sweep the cut height (real metres, as the Slicer slider) and the shrink, and record the truth.
// For each pair: the best lane by shape (no proof), why it is blocked if it is, and whether the real simulator proof clears some lane at that height.
// Usage: npx tsx scripts/places-sweep.ts <slug> [slug...]   (writes data/eval/cc-178-places/sweep-<slug>.json)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { bestSlices, laneSamples, sliceProfile, surfaceSamples } from '../src/slice/slice';
import { laneFacts, looksCrossable, whyNot } from '../src/slice/why';
import { centred } from '../src/slice/world';
import { buildingsFrom, extrude } from '../src/world/osm';
import type { ReadyPlace } from '../src/world/places';

const SHRINKS = [1, 0.333, 0.2, 0.12, 0.07], CUTS = [1, 3, 6, 10, 20, 40]; // real metres above the lowest ground, as the slider
for (const slug of process.argv.slice(2)) {
  const p = JSON.parse(readFileSync(`public/assets/places/${slug}.json`, 'utf8')) as ReadyPlace;
  const ground = p.ground ? { radius: p.radius, ...p.ground } : null;
  const bs = buildingsFrom(p.answer, p.lat, p.lon).filter((b) => b.ring.length >= 3);
  const rows: Record<string, unknown>[] = [];
  for (const k of SHRINKS) {
    const m = extrude(bs, k, ground), piece = centred({ positions: m.positions, indices: m.indices });
    const coarse = surfaceSamples(piece, 20);
    for (const c of CUTS) {
      const level = c * k, t0 = Date.now();
      const shape = bestSlices({ positions: coarse }, { levels: [level], top: 8, prove: false, centre: { x: 0, z: 0 } });
      if (!shape.length) { rows.push({ shrink: k, cutM: c, shapeLane: false, crossableLooking: false, cleared: false, blocked: 'none', secs: (Date.now() - t0) / 1000 }); continue; }
      let facts = laneFacts(shape[0].profile), ok = looksCrossable(facts);
      for (const s of shape) { const f = laneFacts(s.profile), g = looksCrossable(f); if (g && !ok) { facts = f; ok = true; } if (ok) break; }
      const proof = bestSlices({ positions: coarse }, { levels: [level], top: 1, maxProofs: 4, centre: { x: 0, z: 0 }, reprofile: (cd) => sliceProfile(laneSamples(piece, cd, { x: 0, z: 0 }, 80), { x: 0, z: 0 }, cd) });
      rows.push({ shrink: k, cutM: c, shapeLane: true, crossableLooking: ok, cleared: proof.length > 0, blocked: ok ? 'none' : whyNot(facts).blocked, widestGapM: Math.round(facts.widestGapM * 10) / 10, widestGapRealM: Math.round((facts.widestGapM / k) * 10) / 10, tallestStepM: Math.round(facts.tallestStepM * 10) / 10, secs: (Date.now() - t0) / 1000 });
      console.log(slug, JSON.stringify(rows[rows.length - 1]));
      writeFileSync(`data/eval/cc-178-places/sweep-${slug}.partial.json`, JSON.stringify(rows));
    }
  }
  mkdirSync('data/eval/cc-178-places', { recursive: true });
  writeFileSync(`data/eval/cc-178-places/sweep-${slug}.json`, JSON.stringify({ slug, buildings: bs.length, shrinks: SHRINKS, cutsRealM: CUTS, rows }, null, 2) + '\n');
}
