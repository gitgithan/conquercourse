import { describe, expect, it } from 'vitest';
import { roleCourse } from '../src/slice/roles';
import { searchIdealRun } from '../src/sim/ideal';
import { barMesh } from '../src/slice/holds-world';
import { pieceFromSrc } from '../src/slice/photo-course';
import { newPiece, size } from '../src/slice/world';
import { TRACK_SHAPES, TRACK_STEP_DOWN, trackEndY, trackPiece, trackStartY } from '../src/slice/track-world';

const lane = { angle: 0, offset: 0, level: 0 };
const shape = (id: string) => TRACK_SHAPES.find((t) => t.id === id)!.pts;
// sections left to right with a gap between each, then a deck; bars hang over the gaps
function world(ids: string[], gap: number, barY: number | null) {
  const pieces: ReturnType<typeof trackPiece>[] = [];
  let x = 0;
  for (const id of ids) { const q = trackPiece(shape(id), { x: 0, z: 0 }, trackStartY(pieces[pieces.length - 1], shape(id))); const w = size(q.mesh).w; q.x = x + w / 2; x += w + gap; pieces.push(q); }
  const deck = { ...pieceFromSrc('box:10:0.4:2', { x: x + 5, z: 0 }), src: 'box:10:0.4:2', y: trackEndY(pieces[pieces.length - 1]) - TRACK_STEP_DOWN - 0.4 };
  const bars = barY === null ? [] : [{ ...newPiece('Bar', barMesh(), { x: x - gap / 2, z: 0 }), src: 'hold:bar', y: barY }];
  return [...pieces, deck, ...bars] as never[];
}

describe('coaster sections in the editor', () => {
  it('turn the ribbon into rails and start the ride in the cart', () => {
    const { course } = roleCourse(world(['start'], 4, null), lane);
    expect(course.track?.pts.length).toBe(4);
    expect(course.terrain.platforms.some((p) => p.coasterRail)).toBe(true);
    expect(course.startX).toBeCloseTo(course.track!.pts[0][0], 1);
  });
  const clearsWith = (ids: string[], gap: number, bar: number | null) => searchIdealRun(roleCourse(world(ids, gap, bar), lane).course).cleared;
  it('sections that start a little lower than the one before clear, with or without a bar over the gap', () => {
    for (const bar of [null, 2.5]) {
      expect(clearsWith(['start'], 5, bar)).toBe(true);
      expect(clearsWith(['start', 'dip'], 5, bar)).toBe(true);
      expect(clearsWith(['start', 'glide'], 5, bar)).toBe(true);
      expect(clearsWith(['start', 'dip', 'glide'], 3, bar)).toBe(true);
    }
  });
  it('a long flight with little height left is not a ride the simulator can clear', () => {
    expect(clearsWith(['start', 'dip', 'glide'], 5, null)).toBe(false);
  });
});
