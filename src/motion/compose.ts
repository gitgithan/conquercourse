import { Vector3 } from 'three';

// Composing a move from parts, so it follows the course (a wall of any height) instead of a clip made for one height.
// Pure maths: no scene, no page.

const smooth = (t: number): number => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };

// Two-bone reach: where the elbow and the hand go when the hand is sent to `target` from the shoulder `a`.
// The hand stops at full stretch if the target is too far; `pole` says which way the elbow bends.
export function ik2(a: Vector3, target: Vector3, l1: number, l2: number, pole: Vector3): { elbow: Vector3; hand: Vector3 } {
  const d = target.clone().sub(a);
  const dist = Math.min(Math.max(d.length(), Math.abs(l1 - l2) + 1e-4), l1 + l2 - 1e-4);
  const dir = d.lengthSq() > 0 ? d.clone().normalize() : new Vector3(0, 1, 0);
  const along = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
  const out = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const side = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir)));
  if (side.lengthSq() < 1e-9) side.set(-dir.y, dir.x, 0);
  side.normalize();
  return { elbow: a.clone().add(dir.clone().multiplyScalar(along)).add(side.multiplyScalar(out)), hand: a.clone().add(dir.clone().multiplyScalar(dist)) };
}

// How much the arms are reaching for a ledge, 0..1, from how far the ledge is from the shoulder (m) and the arm's length:
// nothing while it is far, rising as it comes within about three arm lengths, full when it is within one. Any wall height works.
export function ledgeReach(distance: number, armLength: number): number {
  return smooth((3.2 * armLength - distance) / (2.15 * armLength));
}

// How much the body is getting ready for the next move, 0..1, from the seconds until it: nothing earlier than 0.5 s, full at 0.15 s.
export function anticipation(secondsToGo: number): number {
  return smooth((0.5 - secondsToGo) / 0.35);
}

export type NextKind = 'gap' | 'wall' | 'rope' | 'bounce';
export interface Next { kind: NextKind; distance: number } // metres ahead along the run

// Get the body ready: sink a little, lean in, and put the arms where the move needs them. `joints` are in the actor's local frame
// (x forward, y up from the feet). Returns nothing; the joints are changed in place.
export function getReady(joints: Vector3[], ix: (name: string) => number, kind: NextKind, w: number): void {
  if (w <= 0) return;
  const sink = kind === 'bounce' ? 0.1 : kind === 'wall' ? 0.05 : 0.08;
  for (const p of joints) p.y *= 1 - sink * w * Math.min(1, p.y / 0.5);
  const lean = (kind === 'gap' ? 0.12 : kind === 'bounce' ? 0.05 : 0.04) * w;
  for (const p of joints) { const x = p.x * Math.cos(-lean) - p.y * Math.sin(-lean), y = p.x * Math.sin(-lean) + p.y * Math.cos(-lean); p.x = x; p.y = y; }
  for (const side of ['Left', 'Right']) {
    const sh = joints[ix(side + 'Arm')];
    const names = ['ForeArm', 'Hand', 'HandThumbEnd', 'HandMiddleEnd'];
    for (const n of names) {
      const p = joints[ix(side + n)];
      if (kind === 'rope') p.add(new Vector3(0.08, 0.5 * (p.y - sh.y < 0 ? 1 : 0.4), 0).multiplyScalar(0.8 * w)); // hands start to go up for the rope
      else if (kind === 'gap' || kind === 'bounce') p.add(new Vector3(-0.2, 0.06, 0).multiplyScalar(w)); // arms swing back to throw forward
    }
  }
}
