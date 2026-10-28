import type { P } from './holds-world';
import { clears } from './roles';

// The proof for a draft made from a photo or a preview: cut the lane from the ground pieces, hang the bars, give the pieces their roles
// (wall, rope anchor, trampoline bed), and ask the ideal-run search whether it clears.
export type Lane = { angle: number; offset: number; level: number };
export const NO_TURN: Lane = { angle: 0, offset: 0, level: 0 };

export function proves(pieces: P[], lane: Lane = NO_TURN): boolean {
  return clears(pieces, lane);
}
