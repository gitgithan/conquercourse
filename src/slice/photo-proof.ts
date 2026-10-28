import { holdsOf, isHold, type P } from './holds-world';
import { laneToCourse, sliceProfile } from './slice';
import { worldSamples } from './world';
import { searchIdealRun } from '../sim/ideal';

// The proof for a draft made from a photo: cut the lane from the ground pieces, hang the bars, and ask the ideal-run search whether it clears.
export type Lane = { angle: number; offset: number; level: number };
export const NO_TURN: Lane = { angle: 0, offset: 0, level: 0 };

export function proves(pieces: P[], lane: Lane = NO_TURN): boolean {
  const pr = sliceProfile(worldSamples(pieces.filter((p) => !isHold(p))), { x: 0, z: 0 }, lane);
  return pr.length >= 8 && searchIdealRun(laneToCourse({ cells: [...pr.cells], length: pr.length, origin: pr.origin }, 'photo draft', holdsOf(pieces, lane))).cleared;
}
