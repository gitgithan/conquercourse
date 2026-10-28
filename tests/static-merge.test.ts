import { describe, expect, it } from 'vitest';
import { BoxGeometry, BufferGeometry, Float32BufferAttribute, MeshStandardMaterial, Vector3 } from 'three/webgpu';
import { CHUNK_OVER, chunkGeometry, chunked, cullFar, mergeStatic, triangleCount } from '../src/render/static-merge';

const boxAt = (x: number, z: number) => { const g = new BoxGeometry(2, 2, 2); g.translate(x, 1, z); return g; };

describe('static geometry in few draws (CC-75)', () => {
  it('merges parts into one mesh per material and keeps every triangle', () => {
    const a = new MeshStandardMaterial(), b = new MeshStandardMaterial();
    const meshes = mergeStatic([{ geo: boxAt(0, 0), mat: a }, { geo: boxAt(5, 0), mat: a }, { geo: boxAt(9, 0), mat: b }]);
    expect(meshes).toHaveLength(2);
    expect(meshes.reduce((n, m) => n + triangleCount(m.geometry), 0)).toBe(3 * 12);
  });
  it('chunks a big geometry by grid cell without losing or inventing triangles', () => {
    const mat = new MeshStandardMaterial();
    const [merged] = mergeStatic(Array.from({ length: 400 }, (_, i) => ({ geo: boxAt((i % 20) * 10, Math.floor(i / 20) * 10), mat })));
    const parts = chunkGeometry(merged.geometry, 64);
    expect(parts.length).toBeGreaterThan(4);
    expect(parts.reduce((n, g) => n + triangleCount(g), 0)).toBe(triangleCount(merged.geometry));
    for (const g of parts) expect(g.boundingSphere!.radius).toBeLessThan(64 * 1.5); // each chunk is small, so the renderer can skip it
  });
  it('leaves a small mesh alone and cuts a big one', () => {
    const mat = new MeshStandardMaterial();
    const small = mergeStatic([{ geo: boxAt(0, 0), mat }]);
    expect(chunked(small)).toHaveLength(1);
    const many = mergeStatic(Array.from({ length: Math.ceil(CHUNK_OVER / 12) + 50 }, (_, i) => ({ geo: boxAt((i % 60) * 8, Math.floor(i / 60) * 8), mat })));
    expect(triangleCount(many[0].geometry)).toBeGreaterThan(CHUNK_OVER);
    expect(chunked(many).length).toBeGreaterThan(1);
  });
  it('hides chunks beyond the range and shows the near ones', () => {
    const mat = new MeshStandardMaterial();
    const geo = (x: number) => { const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute([x, 0, 0, x + 1, 0, 0, x, 1, 0], 3)); g.computeBoundingSphere(); return g; };
    const near = mergeStatic([{ geo: geo(0), mat }])[0], far = mergeStatic([{ geo: geo(500), mat: new MeshStandardMaterial() }])[0];
    near.geometry.computeBoundingSphere(); far.geometry.computeBoundingSphere();
    cullFar([near, far], new Vector3(0, 0, 0), 260);
    expect([near.visible, far.visible]).toEqual([true, false]);
  });
});
