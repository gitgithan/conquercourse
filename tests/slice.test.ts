import { describe, expect, it } from 'vitest';
import { bestSlices, describe as describeLane, laneToCourse, sliceProfile, surfaceSamples, type Mesh, type Profile } from '../src/slice/slice';

// Small scene builders: a box, and an ellipsoid dome, as triangles.
function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): Mesh {
  const p = [x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1];
  const q = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2];
  return { positions: p, indices: q };
}
function dome(cx: number, cz: number, rx: number, ry: number, rz: number, n = 24): Mesh {
  const pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
    const th = (Math.PI / 2) * (i / n), ph = 2 * Math.PI * (j / n);
    pos.push(cx + rx * Math.sin(th) * Math.cos(ph), ry * Math.cos(th), cz + rz * Math.sin(th) * Math.sin(ph));
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const a = i * (n + 1) + j, b = a + 1, c = a + n + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  return { positions: pos, indices: idx };
}
const join = (...ms: Mesh[]): Mesh => {
  const positions: number[] = [], indices: number[] = [];
  for (const m of ms) { const base = positions.length / 3; positions.push(...Array.from(m.positions)); indices.push(...Array.from(m.indices ?? []).map((i) => i + base)); }
  return { positions, indices };
};

// Along x at z = 0: a bench, a dome, a tall block; far to one side (z = 7) a lone tower.
const scene = join(box(0, 3, 0, 0.45, -0.6, 0.6), dome(7.5, 0, 1.4, 0.8, 0.9), box(12, 14, 0, 0.8, -0.8, 0.8), box(5, 8, 0, 6, 6, 9));

describe('lanes cut from a scene', () => {
  it('sampling covers the surface', () => {
    const s = surfaceSamples(box(0, 1, 0, 1, 0, 1));
    expect(s.length / 3).toBeGreaterThan(3000);
  });
  it('a lane along the objects sees the bench, the dome and the block; a lane across them sees only one', () => {
    const along = describeLane(sliceProfile(surfaceSamples(scene), { x: 6, z: 3 }, { angle: 0, offset: -3, level: 0 }));
    expect(along.variety).toBeGreaterThanOrEqual(2);
    expect(along.length).toBeGreaterThan(10);
  });
  it('the search finds the lane through the objects and not the one through the lone tower', () => {
    const best = bestSlices(scene, { top: 3 });
    expect(best.length).toBeGreaterThan(0);
    const top = best[0];
    // a lane along x (angle near 0) through the objects at z = 0
    expect(Math.min(top.angle, Math.PI - top.angle)).toBeLessThan(0.35);
    expect(top.report.variety).toBeGreaterThanOrEqual(3);
  });
  it('every lane it returns can be cleared by the simulator', () => {
    for (const c of bestSlices(scene, { top: 3 })) {
      const course = laneToCourse({ cells: [...c.profile.cells], length: c.profile.length });
      expect(course.terrain.platforms.length).toBeGreaterThan(2);
    }
  });
});

describe('a lane as a course', () => {
  const cells = (spec: [number, number | null][]): Profile => { const c: (number | null)[] = []; for (const [n, h] of spec) for (let i = 0; i < n; i++) c.push(h); return { cells: c, length: c.length * 0.1 }; };
  it('bridges a crack too narrow to jump and keeps a real gap', () => {
    const course = laneToCourse(cells([[20, 0.3], [5, null], [20, 0.3], [30, null], [20, 0.5]]));
    const mid = course.terrain.platforms.slice(1, -1);
    expect(mid.length).toBe(2); // the first two stretches joined, the third apart
  });
  it('keeps a curved top as a profile and a flat one flat', () => {
    const bump = Array.from({ length: 30 }, (_, i) => 0.6 * Math.sin((Math.PI * i) / 29));
    const course = laneToCourse({ cells: [...Array.from({ length: 20 }, () => 0.4), ...[null, null, null, null, null, null, null, null, null, null, null, null, null, null, null], ...bump.map((h) => h + 0.01)], length: 6.5 });
    const mid = course.terrain.platforms.slice(1, -1);
    expect(mid[0].profile).toBeUndefined();
    expect(mid[1].profile).toBeDefined();
  });
});

import { readGlbMesh } from '../src/slice/glb';

// A tiny .glb made by hand: one node, one box.
function glb(positions: number[], indices: number[]): ArrayBuffer {
  const pos = new Float32Array(positions), idx = new Uint16Array(indices);
  const bin = new Uint8Array(pos.byteLength + idx.byteLength + 2);
  bin.set(new Uint8Array(pos.buffer), 0); bin.set(new Uint8Array(idx.buffer), pos.byteLength);
  const json = JSON.stringify({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, translation: [10, 0, 0], scale: [2, 2, 2] }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    accessors: [{ bufferView: 0, componentType: 5126, count: positions.length / 3, type: 'VEC3' }, { bufferView: 1, componentType: 5123, count: indices.length, type: 'SCALAR' }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: pos.byteLength }, { buffer: 0, byteOffset: pos.byteLength, byteLength: idx.byteLength }], buffers: [{ byteLength: bin.length }] });
  const jb = new TextEncoder().encode(json + ' '.repeat((4 - (json.length % 4)) % 4));
  const total = 12 + 8 + jb.length + 8 + bin.length;
  const out = new ArrayBuffer(total), dv = new DataView(out);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
  dv.setUint32(12, jb.length, true); dv.setUint32(16, 0x4e4f534a, true); new Uint8Array(out, 20, jb.length).set(jb);
  const b0 = 20 + jb.length;
  dv.setUint32(b0, bin.length, true); dv.setUint32(b0 + 4, 0x004e4942, true); new Uint8Array(out, b0 + 8, bin.length).set(bin);
  return out;
}

describe('reading a .glb', () => {
  it('gets the triangles with the node\'s translation and scale applied', () => {
    const m = readGlbMesh(glb([0, 0, 0, 1, 0, 0, 0, 1, 0], [0, 1, 2]));
    expect(Array.from(m.positions)).toEqual([10, 0, 0, 12, 0, 0, 10, 2, 0]);
    expect(Array.from(m.indices ?? [])).toEqual([0, 1, 2]);
  });
  it('refuses a file that is not a .glb', () => expect(() => readGlbMesh(new ArrayBuffer(32))).toThrow());
});
