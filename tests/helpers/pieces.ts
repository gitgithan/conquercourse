import { newPiece } from '../../src/slice/world';
import type { P } from '../../src/slice/holds-world';
import type { Mesh } from '../../src/slice/slice';

// Shared builders for editor and fix-it tests (one copy, instead of a `box`, `deck` and `lane` in every file).
/** A box w wide, h tall, d deep, centred on x and z, standing on y = 0. */
export function box(w: number, h: number, d: number): Mesh {
  const [x0, x1, y0, y1, z0, z1] = [-w / 2, w / 2, 0, h, -d / 2, d / 2];
  const p = [x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1];
  const q = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2];
  return { positions: p, indices: q };
}
/** A deck piece: x is its middle, w its width (0.5 m thick, 1.8 m deep). */
export const deck = (x: number, w: number): P => ({ ...newPiece('Deck', box(w, 0.5, 1.8), { x, z: 0 }), src: 'x' });
/** The plain lane setting: straight, no offset, level. */
export const lane = { angle: 0, offset: 0, level: 0 };
