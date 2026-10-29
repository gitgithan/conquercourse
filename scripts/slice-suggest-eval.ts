// CC-179: do the rule-based suggestions fix the places that fail? For each failing (place, shrink, cut) take the plain reason and the ranked fixes,
// apply each one the way the button would, and run the same proved check again. Writes data/eval/slice-ux/suggestions-<slug>.json.
// Usage: npx tsx scripts/slice-suggest-eval.ts <slug...>   (env SCENARIOS="0.2,0.4" for the shrinks, HALF=1 to start with every other building left out)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { buildingTops, cutRange, piecesFrom } from '../src/slice/slicer';
import { buildingsFrom, extrude } from '../src/world/osm';
import { provedLane, quickLane, stripRows } from '../src/slice/slicer-core';
import { explainNoPath, type SuggestAction } from '../src/slice/suggest';
import type { Ground } from '../src/world/terrain';

const shrinks = (process.env.SCENARIOS ?? '0.2,0.4').split(',').map(Number);
const open = (slug: string, k: number, half: boolean, picked?: Set<number>) => {
  const p = JSON.parse(readFileSync(`public/assets/places/${slug}.json`, 'utf8'));
  const ground: Ground | null = p.ground ? { radius: p.radius, ...p.ground } : null;
  const tops = buildingTops(buildingsFrom(p.answer, p.lat, p.lon), k, ground);
  const pk = picked ?? new Set([...tops.keys()].filter((i) => !half || i % 2 === 0));
  const m = extrude(tops.filter((_, i) => pk.has(i)).map((t) => t.b), k, ground);
  return { tops, picked: pk, place: { mesh: { positions: m.positions, indices: m.indices }, pieces: piecesFrom(tops, pk, k, ground) }, range: cutRange(tops, ground), ground };
};
const r1 = (v: number) => Math.round(v * 10) / 10;
for (const slug of process.argv.slice(2)) {
  const rows: Record<string, unknown>[] = [];
  for (const k of shrinks) for (const half of [false, true]) {
    const w = open(slug, k, half);
    const cuts = Array.from({ length: 5 }, (_, i) => Math.max(0.5, Math.round((w.range * (i + 0.5)) / 5 * 2) / 2));
    const strip = stripRows(w.place.mesh, cuts.map((c) => c * k)).map((r, i) => ({ real: cuts[i], lane: r.lane, crossable: r.crossable }));
    for (const cut of cuts) {
      const level = cut * k, quick = quickLane(w.place, level);
      if (provedLane(w.place, level)) continue; // it works: nothing to explain
      const a = explainNoPath({ facts: quick?.facts ?? null, k, cut, strip, picked: w.picked.size, total: w.tops.length });
      const tries = a.suggestions.map((sg) => {
        const act: SuggestAction = sg.action;
        if (act.kind === 'drag') return { text: sg.text, action: act, cleared: null };
        let ww = w, kk = k, cc = cut;
        if (act.kind === 'cut') cc = act.value;
        if (act.kind === 'shrink') { kk = act.value; ww = open(slug, kk, half); }
        if (act.kind === 'pickall') ww = open(slug, k, false);
        return { text: sg.text, action: act, cleared: !!provedLane(ww.place, cc * kk) };
      });
      const row = { slug, shrink: k, halfPicked: half, cut, widestGapM: quick?.facts ? r1(quick.facts.widestGapM) : null, tallestStepM: quick?.facts ? r1(quick.facts.tallestStepM) : null, reason: a.reason, kind: a.kind, tries };
      rows.push(row); console.log(JSON.stringify(row));
    }
  }
  mkdirSync('data/eval/slice-ux', { recursive: true });
  writeFileSync(`data/eval/slice-ux/suggestions-${slug}.json`, JSON.stringify(rows, null, 2) + '\n');
}
