import { afterEach, expect, it, vi } from 'vitest';
import { loadClipUrl, sampleClip } from '../src/motion/clip';
import { BoxGeometry } from 'three';
import { disposeGeometry, retainGeometry } from '../src/render/shared-assets';
afterEach(() => vi.unstubAllGlobals());
const clip = { names: ['hips'], parents: [-1], fps: 30, frames: [[[0, 0, 0]], [[1, 0, 0]]] };
it('concurrent actors share parsed clips and posing does not change the cached frames', async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify(clip)));
  vi.stubGlobal('fetch', fetcher);
  const [a, b] = await Promise.all([loadClipUrl('/coalesced.json'), loadClipUrl('/coalesced.json')]);
  expect(a).toBe(b); expect(fetcher).toHaveBeenCalledOnce();
  sampleClip(a, 0.01, false)[0][0] = 99;
  expect(a.frames).toEqual(clip.frames);
});
it('a failed clip request can be retried', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response('', { status: 503 })).mockResolvedValueOnce(new Response(JSON.stringify(clip)));
  vi.stubGlobal('fetch', fetcher);
  await expect(loadClipUrl('/retry.json')).rejects.toThrow('503');
  await expect(loadClipUrl('/retry.json')).resolves.toEqual(clip);
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it('session cleanup keeps cached GPU geometry but disposes course geometry', () => {
  const model = new BoxGeometry(), course = new BoxGeometry();
  const shared = vi.spyOn(model, 'dispose'), own = vi.spyOn(course, 'dispose');
  retainGeometry(model); disposeGeometry(model); disposeGeometry(course);
  expect(shared).not.toHaveBeenCalled(); expect(own).toHaveBeenCalledOnce(); model.dispose();
});

it('cached character templates give each actor independent bones and materials', async () => {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const { Group, Bone, SkinnedMesh, Skeleton, MeshStandardMaterial } = await import('three');
  const { loadClip: fixture } = await import('./helpers/clips');
  const { loadRookie } = await import('../src/render/rookie');
  const motion = fixture('run'), template = new Group();
  const bones = motion.names.map((name) => Object.assign(new Bone(), { name }));
  bones.forEach((bone, i) => {
    const parent = motion.parents[i];
    const point = motion.frames[0][i], above = parent < 0 ? [0, 0, 0] : motion.frames[0][parent];
    bone.position.set(point[0] - above[0], point[1] - above[1], point[2] - above[2]);
    (parent < 0 ? template : bones[parent]).add(bone);
  });
  const mesh = new SkinnedMesh(new BoxGeometry(), new MeshStandardMaterial());
  template.add(mesh);
  template.updateMatrixWorld(true); mesh.bind(new Skeleton(bones));
  const loader = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue({ scene: template } as never);
  try {
    const [a, b] = await Promise.all([loadRookie('a', motion.names, motion.parents, '/cache-unit'), loadRookie('a', motion.names, motion.parents, '/cache-unit')]);
    expect(loader).toHaveBeenCalledOnce(); expect(a.bones[0]).not.toBe(b.bones[0]);
    const before = b.bones[0].position.clone(); a.bones[0].position.x += 3;
    expect(b.bones[0].position).toEqual(before);
    const am = a.object.children.find((c) => c.type === 'SkinnedMesh') as typeof mesh;
    const bm = b.object.children.find((c) => c.type === 'SkinnedMesh') as typeof mesh;
    expect(am.skeleton).not.toBe(bm.skeleton); expect(am.skeleton.bones[0]).toBe(a.bones[0]);
    expect(am.geometry).toBe(bm.geometry); expect(am.material).not.toBe(bm.material);
  } finally { loader.mockRestore(); }
});
