import { HALF_LANE } from './slice';
import type { Mesh } from './slice';
import type { Piece } from './world';

// Bars in the editor: a piece whose src is "hold:bar" is a thin bar across the lane. It is not ground (the slice ignores it);
// it becomes a hold in the course. Its height off the ground is the bar's height.
export type P = Piece & { src?: string };
export const isHold = (p: P): boolean => p.src === 'hold:bar';
export const HOLD_LENGTH = 2.0; // m across the lane
export const REACH_STANDING = 2.7; // m: hands 2.1 m over the feet plus the 0.6 m reach (src/sim/holds.ts)
export const REACH_JUMPING = 3.7; // m: a jump lifts the hands about 1 m more

export function barMesh(): Mesh {
  const [w, h, d] = [0.08, 0.08, HOLD_LENGTH];
  const [x0, x1, y0, y1, z0, z1] = [-w / 2, w / 2, 0, h, -d / 2, d / 2];
  const p = [x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1];
  const q = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2];
  return { positions: p, indices: q };
}

// The bars that fall inside the lane: u along the run (from the rod), y above the water level.
export function holdsOf(pieces: P[], lane: { angle: number; offset: number; level: number }): { u: number; y: number; id: number }[] {
  const c = Math.cos(lane.angle), s = Math.sin(lane.angle);
  const out: { u: number; y: number; id: number }[] = [];
  for (const p of pieces) {
    if (!isHold(p)) continue;
    const u = p.x * c + p.z * s, v = -p.x * s + p.z * c - lane.offset, y = p.y + 0.04 - lane.level;
    if (Math.abs(v) <= HALF_LANE + 0.5 && y > 0.3) out.push({ u, y, id: p.id });
  }
  return out.sort((a, b) => a.u - b.u);
}
