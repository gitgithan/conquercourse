import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { retainGeometry, retainTexture } from './shared-assets';
import { Matrix4, Object3D, Quaternion, SkinnedMesh, Vector3 } from 'three/webgpu';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { solveBones, type Rig } from '../motion/pose';
import { legLength } from '../motion/timeline';
import { fitToSkeleton, type FitReport } from '../characters/fit';

export type RookieId = 'a' | 'b';

export interface PosedRookie {
  object: Object3D;
  rig: Rig;
  bones: Object3D[]; // clip order
  legLength: number; // metres
  fit: FitReport | null; // how the skin was fitted to the bones when it was loaded (a made character), else null
  lift: number; // metres the hips were raised above the path to keep the feet on the floor
  apply(joints: Vector3[], opts?: { floor?: boolean }): void; // bones aim at these world joint positions; `floor: false` keeps them exactly there (no lift to keep the feet above the floor: the vault's feet are not near the ground)
  world(): Vector3[]; // where the bones are now
}

const models = new Map<string, Promise<Awaited<ReturnType<GLTFLoader['loadAsync']>>>>();

// `url` swaps in another body built on the Rookie's 34 bones (the custom look, CC-41); the default is rookie-<id>.glb
export async function loadRookie(id: RookieId, names: string[], parents: number[], base = '/assets/characters', url?: string, fit = false): Promise<PosedRookie> {
  const src = url ?? `${base}/rookie-${id}.glb`;
  let loading = !url ? models.get(src) : undefined;
  if (!loading) {
    loading = new GLTFLoader().loadAsync(src);
    if (!url) { models.set(src, loading); loading.catch(() => models.delete(src)); }
  }
  const gltf = await loading;
  const object = url ? gltf.scene : clone(gltf.scene);
  if (!url) object.traverse((o) => {
    const m = o as SkinnedMesh;
    if (!m.geometry) return;
    retainGeometry(m.geometry);
    for (const material of Array.isArray(m.material) ? m.material : [m.material]) for (const value of Object.values(material)) if (value?.isTexture) retainTexture(value);
    m.material = Array.isArray(m.material) ? m.material.map((v) => v.clone()) : m.material.clone();
  });
  const fitted = fit && url ? fitSkins(object, url.match(/\/([0-9a-f]{16})\.glb/)?.[1]) : null; // a made character: stretch the skin to the one skeleton before anything reads the rest pose
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
    fit: fitted,
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

/** Fits every skinned mesh of a loaded character to its own bones (the bones are the Rookie's), in the bind pose. Returns the report of the biggest mesh. */
export function fitSkins(root: Object3D, id?: string): FitReport | null {
  let report: FitReport | null = null, most = 0;
  root.traverse((o) => {
    const m = o as SkinnedMesh;
    if (!m.isSkinnedMesh) return;
    const g = m.geometry, pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
    if (!pos || !si || !sw) return;
    const inv = new Matrix4();
    const rest = m.skeleton.boneInverses.map((b) => { const e = inv.copy(b).invert().elements; return [e[12], e[13], e[14]] as [number, number, number]; });
    const r = fitToSkeleton({ positions: pos.array as Float32Array, joints: si.array, weights: sw.array, names: m.skeleton.bones.map((b) => b.name), rest, index: g.index?.array }, { id });
    pos.needsUpdate = true; si.needsUpdate = true; // the skin may have been turned around: new positions and left/right bone indices
    g.computeVertexNormals();
    g.computeBoundingSphere(); g.computeBoundingBox();
    if (pos.count > most) { most = pos.count; report = r; }
  });
  return report;
}

/** The worst and mean stretch of any triangle edge of a posed character against its bind pose (1 = nothing moved; a body that explodes shows several). */
export function skinStretch(root: Object3D): { worst: number; mean: number } {
  let worst = 1, sum = 0, n = 0; const a = new Vector3(), b = new Vector3();
  root.traverse((o) => {
    const m = o as SkinnedMesh;
    if (!m.isSkinnedMesh) return;
    const idx = m.geometry.index!, pos = m.geometry.attributes.position;
    const rest = (i: number) => new Vector3().fromBufferAttribute(pos, i);
    for (let f = 0; f < idx.count; f += 3 * 3) { // every third triangle
      const i0 = idx.getX(f), i1 = idx.getX(f + 1);
      const r = rest(i0).distanceTo(rest(i1));
      if (r < 1e-4) continue;
      m.getVertexPosition(i0, a); m.getVertexPosition(i1, b);
      const k = a.distanceTo(b) / r; worst = Math.max(worst, k, 1 / Math.max(k, 1e-6)); sum += k; n++;
    }
  });
  return { worst, mean: sum / Math.max(1, n) };
}
