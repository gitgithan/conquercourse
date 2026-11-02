import { describe, expect, it } from 'vitest';
import { barMesh, holdsOf, isHold, type P } from '../src/slice/holds-world';
import { laneToCourse, sliceProfile } from '../src/slice/slice';
import { newPiece, worldSamples } from '../src/slice/world';
import { searchIdealRun } from '../src/sim/ideal';
import { deck, lane } from './helpers/pieces';

const bar = (x: number, y: number): P => ({ ...newPiece('Bar', barMesh(), { x, z: 0 }), src: 'hold:bar', y });

// two decks 9 m apart with two bars hanging over the water between them (the lache pair, as built in the editor)
const world = (): P[] => [deck(0, 8), deck(17, 8), bar(6.5, 2.86), bar(10, 2.86)];

const courseOf = (ps: P[]) => {
  const ground = ps.filter((p) => !isHold(p));
  return laneToCourse(sliceProfile(worldSamples(ground), { x: 0, z: 0 }, lane), 'test', holdsOf(ps, lane));
};

describe('bars built in the editor', () => {
  it('are found inside the lane and ignored outside it, and are not ground', () => {
    const hs = holdsOf(world(), lane);
    expect(hs.length).toBe(2);
    expect(hs[0].u).toBeCloseTo(6.5, 6);
    expect(hs[0].y).toBeCloseTo(2.9, 6);
    expect(holdsOf([bar(6.5, 2.86)].map((b) => ({ ...b, z: 5 })), lane)).toEqual([]);
    expect(holdsOf([bar(6.5, 0.1)], lane)).toEqual([]); // a bar on the ground is no bar
  });
  it('become holds in the course, with the real gap kept and jumps costing speed', () => {
    const c = courseOf(world());
    expect(c.holds?.length).toBe(2);
    expect(c.jumpKeep).toBeLessThan(1);
    const [a, b] = c.terrain.platforms.slice(1);
    expect(b.x0 - a.x1).toBeGreaterThan(8); // the 9 m gap is not squeezed to 5 m
    expect(c.holds![0].x).toBeGreaterThan(a.x1); // the bars hang over the water between the two decks
    expect(c.holds![1].x).toBeLessThan(b.x0);
  });
  it('make a lane the simulator can clear that it could not without them', () => {
    expect(searchIdealRun(courseOf(world())).cleared).toBe(true);
    expect(searchIdealRun({ ...courseOf(world()), holds: undefined }).cleared).toBe(false); // the same water with the bars taken away
  });
});
