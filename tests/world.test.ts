import { describe, expect, it } from 'vitest';
import { box, brick, dome } from '../src/slice/shapes';
import { bestSlices, describe as describeLane, laneToCourse, sliceProfile } from '../src/slice/slice';
import { crop, duplicate, hits, newPiece, pieceSamples, realSize, scaleBy, scaleToHeight, worldSamples } from '../src/slice/world';
import { searchIdealRun } from '../src/sim/ideal';

const laneOf = (pieces: ReturnType<typeof newPiece>[], offset = 0) => sliceProfile(worldSamples(pieces), { x: 0, z: 0 }, { angle: 0, offset, level: 0 });
const maxH = (cells: (number | null)[]) => Math.max(...cells.map((c) => c ?? 0));

describe('pieces in a world', () => {
  it('a piece stands on the ground and is centred', () => {
    const p = newPiece('b', box(2, 1, 1));
    const s = pieceSamples(p);
    let ymin = Infinity;
    for (let i = 1; i < s.length; i += 3) ymin = Math.min(ymin, s[i]);
    expect(ymin).toBeCloseTo(0, 6);
  });
  it('scaling to a real height sets the real size', () => {
    const p = scaleToHeight(newPiece('b', box(2, 1, 1)), 0.45);
    expect(realSize(p).h).toBeCloseTo(0.45, 9);
    expect(realSize(p).w).toBeCloseTo(0.9, 9);
  });
  it('a toy brick enlarged to half a metre is the same lane as a half-metre block', () => {
    const toy = scaleToHeight(newPiece('brick', brick()), 0.5); // brick body and studs: 0.0113 m tall at scale 1
    const block = newPiece('block', box(realSize(toy).w, 0.5, realSize(toy).d));
    expect(maxH(laneOf([toy]).cells)).toBeCloseTo(0.5, 1);
    expect(maxH(laneOf([block]).cells)).toBeCloseTo(0.5, 1);
    expect(laneOf([toy]).length).toBeCloseTo(laneOf([block]).length, 0);
  });
  it('enlarging a small model keeps its surface filled in (no holes in the lane)', () => {
    const toy = scaleBy(newPiece('b', box(0.03, 0.01, 0.015)), 50);
    const cells = laneOf([toy]).cells;
    expect(cells.length).toBeGreaterThan(10);
    expect(cells.every((c) => c !== null)).toBe(true);
  });
  it('copy and paste makes the same piece a little to one side', () => {
    const a = newPiece('b', box(1, 1, 1));
    const b = duplicate(a, 4, 0);
    expect(b.id).not.toBe(a.id);
    expect(b.x - a.x).toBe(4);
    expect(b.mesh).toBe(a.mesh);
  });
  it('turning a piece moves where its samples are, and picking follows the turn', () => {
    const a = { ...newPiece('long', box(4, 1, 0.5)), yaw: Math.PI / 2 };
    expect(hits(a, 0, 1.5)).toBe(true);
    expect(hits(a, 1.5, 0)).toBe(false);
  });
});

describe('cropping', () => {
  it('keeps only the part inside the box and leaves it where it was in the world', () => {
    const p = newPiece('long', box(6, 1, 1), { x: 10, z: 0 });
    const c = crop(p, { x0: 0, z0: -1, x1: 3, z1: 1 })!; // the right half
    expect(c).not.toBeNull();
    const before = pieceSamples(p), after = pieceSamples(c);
    let minBefore = Infinity, minAfter = Infinity;
    for (let i = 0; i < after.length; i += 3) minAfter = Math.min(minAfter, after[i]);
    for (let i = 0; i < before.length; i += 3) minBefore = Math.min(minBefore, before[i]);
    expect(minBefore).toBeCloseTo(7, 1);
    expect(minAfter).toBeGreaterThan(9.5); // the cut part sits from x = 10 to 13, where it always was
  });
  it('a box that holds nothing gives nothing', () => expect(crop(newPiece('b', box(1, 1, 1)), { x0: 5, z0: 5, x1: 6, z1: 6 })).toBeNull());
});

describe('a course from pieces', () => {
  const pieces = [
    { ...newPiece('bench', box(1.8, 0.45, 0.5)), x: 2 },
    { ...newPiece('dome', dome(1.5, 0.8, 1)), x: 8 },
    { ...newPiece('wall', box(3, 0.8, 0.4)), x: 14 },
  ];
  it('the lane through them has gaps, steps and curves, and the simulator can clear it', () => {
    const p = laneOf(pieces);
    const r = describeLane(p);
    expect(r.gaps).toBeGreaterThanOrEqual(2);
    expect(r.curves).toBeGreaterThanOrEqual(1);
    expect(searchIdealRun(laneToCourse(p)).cleared).toBe(true);
  });
  it('the search finds that lane in a world with other things in it', () => {
    const world = [...pieces, { ...newPiece('tower', box(3, 6, 3)), x: 8, z: 7 }];
    const best = bestSlices({ positions: Array.from(worldSamples(world)) }, { top: 1 });
    expect(best[0].report.variety).toBeGreaterThanOrEqual(3);
  });
});
