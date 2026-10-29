import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildingTops, cutRange, piecesFrom } from '../src/slice/slicer';
import { pathAt } from '../src/slice/slicer-core';
import { buildingsFrom, extrude } from '../src/world/osm';
import type { Ground } from '../src/world/terrain';

// CC-202: pathAt is the one question the page asks before it paints a height green. It must be repeatable, and a height far above everything must not give a path.
function place(slug: string, k: number) {
  const p = JSON.parse(readFileSync(`public/assets/places/${slug}.json`, 'utf8'));
  const ground: Ground | null = p.ground ? { radius: p.radius, ...p.ground } : null;
  const tops = buildingTops(buildingsFrom(p.answer, p.lat, p.lon), k, ground), all = new Set(tops.keys());
  const m = extrude(tops.map((t) => t.b), k, ground);
  return { mesh: { positions: m.positions, indices: m.indices }, pieces: piecesFrom(tops, all, k, ground), range: cutRange(tops, ground) };
}

describe('pathAt', () => {
  it('gives the same answer twice at the same height', () => {
    const pl = place('montmartre-paris', 0.2);
    const h = Math.round(pl.range * 0.35 * 2) / 2 * 0.2;
    expect(pathAt(pl, h)).toBe(pathAt(pl, h));
  }, 120000);
  it('a cut above every roof leaves nothing to run on', () => {
    const pl = place('eixample-barcelona', 0.2);
    expect(pathAt(pl, (pl.range + 50) * 0.2)).toBe(false);
  }, 120000);
});
