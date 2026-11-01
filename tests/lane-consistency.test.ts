// CC-91: the lane the map proved is the lane the editor reads.
// Before the fix the editor read a big scene from a thinned sample (at most 40,000 points) and saw false walls on the very lane the map had cleared.
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { laneSamples, laneToCourse, sliceProfile, describe as describeLane, CLIMBABLE } from '../src/slice/slice';
import { centred, laneProfile, newPiece } from '../src/slice/world';
import { buildingsFrom, osmToMesh } from '../src/world/osm';
import { buildingTops, piecesFrom } from '../src/slice/slicer';
import { searchIdealRun } from '../src/sim/ideal';
import type { Ground } from '../src/world/terrain';

const DIR = 'public/assets/places/';
const slugs = readdirSync(DIR).filter((f) => f.endsWith('.json') && !['index.json', 'photos-index.json', 'slicer-defaults.json'].includes(f)).map((f) => f.replace('.json', ''));

function load(slug: string) {
  const p = JSON.parse(readFileSync(DIR + slug + '.json', 'utf8'));
  const ground: Ground | null = p.ground ? { radius: p.radius, ...p.ground } : null;
  const k: number = p.lane.shrink, m = osmToMesh(p.answer, p.lat, p.lon, k, ground);
  const lane = { angle: (p.lane.turnDeg * Math.PI) / 180, offset: p.lane.sidewaysM as number, level: p.lane.levelM as number };
  return { p, ground, k, m, lane, mesh: centred({ positions: m.positions, indices: m.indices }) };
}
const differ = (a: (number | null)[], b: (number | null)[]) => { let n = 0; for (let i = 0; i < Math.max(a.length, b.length); i++) { const x = a[i] ?? null, y = b[i] ?? null; if ((x === null) !== (y === null) || (x !== null && y !== null && Math.abs(x - y) > 0.05)) n++; } return n; };

describe('the editor reads the lane the map proved (CC-91)', () => {
  it('has the ready places to check', () => { expect(slugs.length).toBeGreaterThanOrEqual(10); });

  it.each(slugs)('%s: same lane, same cells in the map and in the editor', (slug) => {
    const { p, m, lane, mesh } = load(slug);
    const map = sliceProfile(laneSamples(mesh, lane), { x: 0, z: 0 }, lane);
    const editor = laneProfile([newPiece('Place', { positions: m.positions, indices: m.indices })], lane);
    expect(editor.cells.length).toBe(map.cells.length);
    expect(differ(map.cells, editor.cells)).toBe(0);
    expect(describeLane(editor).maxRise).toBeLessThanOrEqual(CLIMBABLE); // no false wall on a lane the map cleared
    const filled = editor.cells.filter((c) => c !== null).length;
    expect(filled / editor.cells.length).toBeGreaterThan(0.2); // the pieces lie along the lane (the rest is the gaps between buildings)
    expect(Math.abs(editor.length - p.lane.lengthM)).toBeLessThan(0.5); // and it is the length the map reported
  });

  it.each(['montmartre-paris', 'shibuya-tokyo', 'valletta-harbour-malta'])('%s: picked buildings handed over one by one read the same lane as the whole mesh', (slug) => {
    const { p, ground, k, m, lane } = load(slug);
    // the Slicer works in metres from the pin, not centred: the same line is the same turn with the sideways step moved by the middle of the place
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < m.positions.length; i += 3) { x0 = Math.min(x0, m.positions[i]); x1 = Math.max(x1, m.positions[i]); z0 = Math.min(z0, m.positions[i + 2]); z1 = Math.max(z1, m.positions[i + 2]); }
    const ox = (x0 + x1) / 2, oz = (z0 + z1) / 2;
    const pin = { angle: lane.angle, offset: lane.offset + ox * -Math.sin(lane.angle) + oz * Math.cos(lane.angle), level: lane.level };
    const tops = buildingTops(buildingsFrom(p.answer, p.lat, p.lon), k, ground);
    const pieces = piecesFrom(tops, new Set(tops.keys()), k, ground).map((q) => newPiece(q.name, { positions: q.positions, indices: q.indices }, { x: q.x, z: q.z }));
    const handed = laneProfile(pieces, pin);
    const whole = sliceProfile(laneSamples({ positions: m.positions, indices: m.indices }, pin), { x: 0, z: 0 }, pin);
    expect(Math.abs(handed.cells.length - whole.cells.length)).toBeLessThanOrEqual(2);
    // cells line up by their distance along the run (origin): compare by that
    const shift = Math.round(((handed.origin ?? 0) - (whole.origin ?? 0)) / 0.1);
    let off = 0;
    for (let i = 0; i < whole.cells.length; i++) { const a = whole.cells[i], b = handed.cells[i - shift] ?? null; if ((a === null) !== (b === null) || (a !== null && b !== null && Math.abs(a - b) > 0.1)) off++; }
    expect(off / whole.cells.length).toBeLessThan(0.03);
  });

  it.each(['shibuya-tokyo', 'valletta-harbour-malta'])('%s: the lane the map cleared clears again from the editor reading', (slug) => {
    const { m, lane } = load(slug);
    const editor = laneProfile([newPiece('Place', { positions: m.positions, indices: m.indices })], lane);
    const course = laneToCourse({ cells: [...editor.cells], length: editor.length });
    expect(searchIdealRun(course).cleared).toBe(true);
  }, 240_000);
});
