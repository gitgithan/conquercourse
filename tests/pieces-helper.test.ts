import { describe, expect, it } from 'vitest';
import { box, deck, lane } from './helpers/pieces';

// Recorded from the box and deck copies in the test files before they moved (CC-133, item 6).
describe('shared piece builders', () => {
  it('box is the same 8 corners and 12 triangles as the old copies', () => {
    expect(box(2, 1, 4)).toEqual({
      positions: [-1, 0, -2, 1, 0, -2, 1, 1, -2, -1, 1, -2, -1, 0, 2, 1, 0, 2, 1, 1, 2, -1, 1, 2],
      indices: [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2],
    });
  });
  it('deck is a Deck piece 0.5 m thick and 1.8 m deep', () => {
    const d = deck(3, 8);
    expect(d.name).toBe('Deck');
    expect(d.src).toBe('x');
    expect(d.mesh).toEqual(box(8, 0.5, 1.8));
  });
  it('lane is the plain setting', () => { expect(lane).toEqual({ angle: 0, offset: 0, level: 0 }); });
});
