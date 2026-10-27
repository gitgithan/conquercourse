import { Quaternion, Vector3 } from 'three/webgpu';

// A bone in clip order: rest pose in the character's own frame.
export interface RigBone {
  name: string;
  parent: number; // clip order, -1 for the hips
  restPos: Vector3; // world, at rest
  restQuat: Quaternion; // world, at rest
}

export interface Rig {
  bones: RigBone[];
  rootQuat: Quaternion; // world rotation of the hips' parent
}

// Clip axes (run +z, left +x) to game axes (run +x, left -z); up stays up.
export const clipToWorld = (p: number[]): Vector3 => new Vector3(p[2], p[1], -p[0]);

const idx = (names: string[], n: string) => names.indexOf(n);

// The child each bone aims at; bones not listed here keep their parent's turn.
export function aimChildren(names: string[], parents: number[]): number[] {
  const aim = names.map(() => -1);
  const first = (i: number) => parents.findIndex((p) => p === i);
  names.forEach((n, i) => {
    if (/Hand$/.test(n)) aim[i] = idx(names, n + 'MiddleEnd');
    else if (/^(Head|Jaw|LeftEye|RightEye|.*End|.*ToeBase)$/.test(n)) aim[i] = -1;
    else aim[i] = first(i);
  });
  return aim;
}

const arc = (from: Vector3, to: Vector3): Quaternion => new Quaternion().setFromUnitVectors(from.clone().normalize(), to.clone().normalize());

// Turn about `axis` so that `from` lands on `to` (both flattened to the plane across the axis).
function twist(axis: Vector3, from: Vector3, to: Vector3): Quaternion {
  const a = from.clone().projectOnPlane(axis).normalize();
  const b = to.clone().projectOnPlane(axis).normalize();
  if (a.lengthSq() === 0 || b.lengthSq() === 0) return new Quaternion();
  const angle = Math.atan2(axis.dot(a.clone().cross(b)), a.dot(b));
  return new Quaternion().setFromAxisAngle(axis, angle);
}

// Local rotations that make each bone point at its child's joint position (world space, joints in clip order).
// The hips and chest also take the side-to-side turn from the legs and shoulders.
export function solveBones(rig: Rig, parents: number[], names: string[], joints: Vector3[]): Quaternion[] {
  const aim = aimChildren(names, parents);
  const side: Record<string, [string, string]> = { Hips: ['LeftLeg', 'RightLeg'], Chest: ['LeftShoulder', 'RightShoulder'] };
  const world: Quaternion[] = [];
  const local: Quaternion[] = [];
  rig.bones.forEach((b, i) => {
    const restParentQ = b.parent < 0 ? rig.rootQuat : rig.bones[b.parent].restQuat;
    const parentQ = b.parent < 0 ? rig.rootQuat : world[b.parent];
    // keep the rest offset from the parent, carried by the parent's pose
    let q = parentQ.clone().multiply(restParentQ.clone().invert()).multiply(b.restQuat);
    const c = aim[i];
    if (c >= 0) {
      const restDir = rig.bones[c].restPos.clone().sub(b.restPos);
      const cur = restDir.clone().applyQuaternion(q.clone().multiply(b.restQuat.clone().invert()));
      const target = joints[c].clone().sub(joints[i]);
      q = arc(cur, target).multiply(q);
      const pair = side[b.name];
      if (pair) {
        const [l, r] = pair.map((n) => idx(names, n));
        const restSide = rig.bones[l].restPos.clone().sub(rig.bones[r].restPos);
        const curSide = restSide.clone().applyQuaternion(q.clone().multiply(b.restQuat.clone().invert()));
        const tgtSide = joints[l].clone().sub(joints[r]);
        q = twist(target.clone().normalize(), curSide, tgtSide).multiply(q);
      }
    }
    world[i] = q;
    local[i] = parentQ.clone().invert().multiply(q);
  });
  return local;
}
