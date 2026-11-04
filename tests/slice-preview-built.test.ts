// CC-179: what the slicer says about a lane is what the editor says about the same lane after "Build the picked buildings".
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildingTops, cutRange, handoverLane, piecesFrom } from '../src/slice/slicer';
import { buildingsFrom, extrude } from '../src/world/osm';
import { customLane, provedLane, quickLane, worldOf } from '../src/slice/slicer-core';
import { roleCourse } from '../src/slice/roles';
import { searchIdealRun } from '../src/sim/ideal';
import type { Ground } from '../src/world/terrain';

const PLACES = ['eixample-barcelona', 'montmartre-paris', 'circular-quay-sydney', 'shibuya-tokyo', 'tuileries-paris'];
const K = 0.2;
function open(slug: string) {
  const p = JSON.parse(readFileSync(`public/assets/places/${slug}.json`, 'utf8'));
  const ground: Ground | null = p.ground ? { radius: p.radius, ...p.ground } : null;
  const tops = buildingTops(buildingsFrom(p.answer, p.lat, p.lon), K, ground);
  const pieces = piecesFrom(tops, new Set(tops.keys()), K, ground), m = extrude(tops.map((t) => t.b), K, ground);
  return { place: { mesh: { positions: m.positions, indices: m.indices }, pieces }, range: cutRange(tops, ground) };
}
// what the editor does with the handed-over lane
const built = (pieces: ReturnType<typeof open>['place']['pieces'], lane: { angle: number; offset: number; level: number }) => {
  const { course, length } = roleCourse(worldOf(pieces), lane, 'built');
  return length >= 8 && searchIdealRun(course).cleared;
};

describe('the preview and the built course use one check', () => {
  for (const slug of PLACES) {
    it(`${slug}: lanes the preview clears are cleared after the build, lanes it refuses are refused`, () => {
      const { place, range } = open(slug);
      let compared = 0;
      for (const real of [Math.max(0.5, Math.round(range * 0.2 * 2) / 2), Math.round(range * 0.6 * 2) / 2]) {
        const level = real * K, q = quickLane(place, level);
        if (!q) continue;
        const proved = customLane(place, { angle: q.angle, offset: q.offset, level }).proved !== null;
        expect(built(place.pieces, handoverLane(q, real, K)), `${slug} cut ${real}`).toBe(proved);
        const best = provedLane(place, level);
        if (best) expect(built(place.pieces, handoverLane(best, real, K)), `${slug} proved lane at ${real}`).toBe(true);
        compared++;
      }
      expect(compared).toBeGreaterThan(0);
    }, 240_000);
  }
  it('the hand-over sends the shrunk level, not the real cut height', () => {
    expect(handoverLane({ angle: 1, offset: 2 }, 12, 0.2).level).toBe(2.4);
  });
});
