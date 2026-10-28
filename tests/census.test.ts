import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readGlbMesh } from '../src/slice/glb';
import { censusProblems, meshCensus } from '../src/slice/census';
import type { Mesh } from '../src/slice/slice';

// A closed 1 m cube made of 12 triangles.
const cube = (s = 1): Mesh => ({
  positions: [0, 0, 0, s, 0, 0, s, s, 0, 0, s, 0, 0, 0, s, s, 0, s, s, s, s, 0, s, s].map((v) => v),
  indices: [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5],
});

describe('mesh census', () => {
  it('a clean cube has no defects and the right size', () => {
    const c = meshCensus(cube());
    expect(c.size).toEqual([1, 1, 1]);
    expect([c.openEdges, c.nonManifoldEdges, c.flippedEdges, c.looseVertices, c.degenerate]).toEqual([0, 0, 0, 0, 0]);
    expect(censusProblems(c)).toEqual([]);
  });
  it('catches a scale bug (the cube 100 times too big, or too small)', () => {
    expect(censusProblems(meshCensus(cube(100))).join()).toMatch(/scale bug/);
    expect(censusProblems(meshCensus(cube(0.001))).join()).toMatch(/scale bug/);
  });
  it('catches a hole (two triangles of one face removed)', () => {
    const m = cube(), c = meshCensus({ positions: m.positions, indices: m.indices!.slice(6) });
    expect(c.openEdges).toBeGreaterThan(0);
    expect(censusProblems(c).join()).toMatch(/open edges/);
  });
  it('catches a flipped face', () => {
    const idx = Array.from(cube().indices!);
    [idx[1], idx[2]] = [idx[2], idx[1]];
    expect(meshCensus({ positions: cube().positions, indices: idx }).flippedEdges).toBeGreaterThan(0);
  });
  it('every object in the library is a plausible park object', () => {
    const dir = 'public/assets/objects';
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.glb'))) {
      const b = readFileSync(join(dir, f));
      const p = censusProblems(meshCensus(readGlbMesh(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer)));
      expect({ f, p }).toEqual({ f, p: [] });
    }
  });
});
