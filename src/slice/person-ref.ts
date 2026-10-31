// Where the person for scale stands (CC-96): at the start of the lane, a little before the first piece, so it is in view when the editor opens.
import { size, type Piece } from './world';

export const PERSON_GAP = 2.2; // m before the first piece
export const PERSON_SIDE = 1.6; // m beside the lane's middle line, so the person is not in the runner's way or on the rod

export function personStart(pieces: (Piece & { src?: string })[], lane: { angle: number; offset: number }): { x: number; z: number } {
  const c = Math.cos(lane.angle), s = Math.sin(lane.angle);
  const along = pieces.filter((p) => !p.src?.startsWith('obj:../characters/'));
  const u0 = along.length ? Math.min(...along.map((p) => p.x * c + p.z * s - (size(p.mesh).w * p.scale) / 2)) - PERSON_GAP : 0;
  const side = lane.offset + PERSON_SIDE;
  return { x: u0 * c - side * s, z: u0 * s + side * c };
}

// The marker over the person (CC-96): a see-through yellow cone from their feet up to 30 m, so a tall piece cannot hide them.
export const SCALE_BEAM_HEIGHT = 30; // m
export const SCALE_BEAM_RADIUS = 2.5; // m, at the top of the cone (it is a point at the feet)
export const SCALE_RING_INNER = 0.55; // m, the small ring at the feet
export const SCALE_RING_OUTER = 0.7;
export const SCALE_LABEL_HEIGHT = 2.05; // m above the feet: just over a 1.75 m head

// The marker stands exactly where the person stands, whatever moved them (first visit, Fit, a drag, a turn of the lane): it reads their place and keeps none of its own.
export const markerAt = (person: { x: number; z: number }): { x: number; z: number } => ({ x: person.x, z: person.z });
