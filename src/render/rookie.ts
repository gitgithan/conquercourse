import { Object3D, Quaternion, Vector3 } from 'three/webgpu';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { solveBones, type Rig } from '../motion/pose';
import { legLength } from '../motion/timeline';

export type RookieId = 'a' | 'b';

export interface PosedRookie {
  object: Object3D;
  rig: Rig;
  bones: Object3D[]; // clip order
  legLength: number; // metres
  lift: number; // metres the hips were raised above the path to keep the feet on the floor
  apply(joints: Vector3[], opts?: { floor?: boolean }): void; // bones aim at these world joint positions; `floor: false` keeps them exactly there (no lift to keep the feet above the floor: the vault's feet are not near the ground)
  world(): Vector3[]; // where the bones are now
}

// `url` swaps in another body built on the Rookie's 34 bones (the custom look, CC-41); the default is rookie-<id>.glb
export async function loadRookie(id: RookieId, names: string[], parents: number[], base = '/assets/characters', url?: string): Promise<PosedRookie> {
  const gltf = await new GLTFLoader().loadAsync(url ?? `${base}/rookie-${id}.glb`);
  const object = gltf.scene;
  object.updateMatrixWorld(true);
  object.traverse((o) => (o.frustumCulled = false)); // skinned meshes keep their bind-pose bounds
  const bones = names.map((n) => {
    const b = object.getObjectByName(n);
    if (!b) throw new Error(`rookie-${id} has no bone ${n}`);
    return b;
  });
  bones.forEach((b, i) => {
    if (parents[i] >= 0 && b.parent !== bones[parents[i]]) throw new Error(`rookie-${id}: ${b.name} is not under ${names[parents[i]]}`);
  });
  const rig: Rig = {
    rootQuat: bones[0].parent!.getWorldQuaternion(new Quaternion()),
    bones: bones.map((b, i) => ({
      name: names[i],
      parent: parents[i],
      restPos: b.getWorldPosition(new Vector3()),
      restQuat: b.getWorldQuaternion(new Quaternion()),
    })),
  };
  const feet = names.map((n, i) => (/Foot$|ToeBase$/.test(n) ? i : -1)).filter((i) => i >= 0);
  const length = legLength(names, (i) => rig.bones[i].restPos);
  const rookie: PosedRookie = {
    object,
    rig,
    bones,
    legLength: length,
    apply(joints, opts) {
      const q = solveBones(rig, parents, names, joints);
      bones[0].parent!.updateWorldMatrix(true, false);
      bones[0].position.copy(bones[0].parent!.worldToLocal(joints[0].clone()));
      bones.forEach((b, i) => b.quaternion.copy(q[i]));
      object.updateMatrixWorld(true);
      // The aimed bones keep the Rookie's own proportions, so a bent leg can end lower than the clip's: lift the hips
      // by that much so no foot goes through the floor (the lift is reported by `lift`).
      const lowest = Math.min(...feet.map((i) => bones[i].getWorldPosition(new Vector3()).y));
      rookie.lift = opts?.floor === false ? 0 : Math.max(0, -lowest);
      if (rookie.lift > 0) {
        bones[0].position.copy(bones[0].parent!.worldToLocal(joints[0].clone().add(new Vector3(0, rookie.lift, 0))));
        object.updateMatrixWorld(true);
      }
    },
    lift: 0,
    world: () => bones.map((b) => b.getWorldPosition(new Vector3())),
  };
  return rookie;
}
