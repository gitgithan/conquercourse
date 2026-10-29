import { Vector3 } from 'three';

// Keeps the head on a sane neck and the shoulders on the trunk while the body is blended from one pose to another (the grab, the let-go,
// the grab again). Joint positions are lerped between poses, so a folded pose blended into a hang can leave the head thrown back
// and the shoulders pushed forward: here each is limited to a small angle (head) or distance (shoulders) from where the trunk says it belongs.
export const NECK_LIMIT = 0.35; // radians the neck chain may bend from the trunk's line, either way
export const SHOULDER_LIMIT = 0.05; // metres a shoulder may sit off its place on the chest

const NECK = ['Neck1', 'Neck2', 'Head'];
const HEAD_PARTS = ['Jaw', 'LeftEye', 'RightEye'];
const ARM_PARTS = [
  ['LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'LeftHandThumbEnd', 'LeftHandMiddleEnd'],
  ['RightShoulder', 'RightArm', 'RightForeArm', 'RightHand', 'RightHandThumbEnd', 'RightHandMiddleEnd'],
];

const angle = (v: Vector3) => Math.atan2(v.y, v.x);
const turn = (v: Vector3, a: number) => new Vector3(v.x * Math.cos(a) - v.y * Math.sin(a), v.x * Math.sin(a) + v.y * Math.cos(a), v.z);

export function settleNeck(joints: Vector3[], rest: Vector3[], ix: (n: string) => number): void {
  const trunk = (j: Vector3[]) => j[ix('Chest')].clone().sub(j[0]);
  const turned = angle(trunk(joints)) - angle(trunk(rest)); // how far the trunk is turned from standing
  const move = (names: string[], d: Vector3) => { for (const n of names) joints[ix(n)].add(d); };

  // neck chain: each bone may leave the trunk-turned standing direction by NECK_LIMIT at most, and the sum of the bends too
  let parent = 'Chest', cum = 0;
  for (let i = 0; i < NECK.length; i++) {
    const n = NECK[i], p = joints[ix(parent)], c = joints[ix(n)];
    const len = Math.hypot(rest[ix(n)].x - rest[ix(parent)].x, rest[ix(n)].y - rest[ix(parent)].y); // in the side plane; z stays
    const want = angle(rest[ix(n)].clone().sub(rest[ix(parent)])) + turned;
    const a = angle(c.clone().sub(p));
    let off = Math.atan2(Math.sin(a - want), Math.cos(a - want));
    off = Math.max(-NECK_LIMIT, Math.min(NECK_LIMIT, off));
    cum += off;
    if (Math.abs(cum) > NECK_LIMIT) { off -= cum - Math.sign(cum) * NECK_LIMIT; cum = Math.sign(cum) * NECK_LIMIT; }
    const b = want + off;
    const next = p.clone().add(new Vector3(Math.cos(b) * len, Math.sin(b) * len, c.z - p.z));
    move([n, ...NECK.slice(i + 1), ...HEAD_PARTS], next.sub(c));
    parent = n;
  }

  // shoulders: at most SHOULDER_LIMIT from the trunk-turned standing place (the arm below them follows)
  const chest = joints[ix('Chest')];
  for (const side of ARM_PARTS) {
    const sh = side[1], place = turn(rest[ix(sh)].clone().sub(rest[ix('Chest')]), turned).add(chest);
    place.z = joints[ix(sh)].z;
    const d = place.sub(joints[ix(sh)]);
    if (d.length() <= SHOULDER_LIMIT) continue;
    move(side, d.multiplyScalar(1 - SHOULDER_LIMIT / d.length()));
  }
}
