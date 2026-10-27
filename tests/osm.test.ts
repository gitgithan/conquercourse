import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildingsFrom, earClip, extrude, heightOf, MAX_SHRUNK_HEIGHT, osmToMesh, suggestedShrink, type OverpassAnswer } from '../src/world/osm';

const fx = JSON.parse(readFileSync('tests/fixtures/overpass-quay.json', 'utf8')) as OverpassAnswer & { lat: number; lon: number };

describe('OpenStreetMap buildings', () => {
  it('reads heights: tag, else levels x 3 m, else 9 m', () => {
    expect(heightOf({ height: '12.5' })).toEqual({ h: 12.5, real: true });
    expect(heightOf({ 'building:levels': '4' })).toEqual({ h: 12, real: true });
    expect(heightOf({ building: 'yes' })).toEqual({ h: 9, real: false });
  });
  it('places buildings in metres around the pin', () => {
    const bs = buildingsFrom(fx, fx.lat, fx.lon);
    expect(bs.length).toBe(fx.elements.length);
    for (const b of bs) for (const [x, z] of b.ring) expect(Math.hypot(x, z)).toBeLessThan(400);
  });
  it('clips a concave polygon into triangles that cover its area', () => {
    const L: [number, number][] = [[0, 0], [4, 0], [4, 1], [1, 1], [1, 4], [0, 4]]; // an L of area 7
    const area = earClip(L).reduce((s, [a, b, c]) => s + Math.abs((L[b][0] - L[a][0]) * (L[c][1] - L[a][1]) - (L[b][1] - L[a][1]) * (L[c][0] - L[a][0])) / 2, 0);
    expect(area).toBeCloseTo(7, 6);
  });
  it('extrudes a box: stands on y = 0, roof at the shrunk height, roof faces up', () => {
    const m = extrude([{ ring: [[0, 0], [10, 0], [10, 10], [0, 10]], h: 20, real: true }], 0.25);
    const ys = m.positions.filter((_, i) => i % 3 === 1);
    expect(Math.min(...ys)).toBe(0);
    expect(Math.max(...ys)).toBeCloseTo(5, 9);
    for (let i = 0; i < m.indices.length; i += 3) { // every roof triangle (all three corners at the roof) has its normal up
      const [a, b, c] = [0, 1, 2].map((k) => m.indices[i + k] * 3);
      if (![a, b, c].every((v) => m.positions[v + 1] === 5)) continue;
      const u = [0, 1, 2].map((d) => m.positions[b + d] - m.positions[a + d]), w = [0, 1, 2].map((d) => m.positions[c + d] - m.positions[a + d]);
      expect(u[2] * w[0] - u[0] * w[2]).toBeGreaterThan(0);
    }
  });
  it('caps tall buildings after the shrink', () => {
    const m = extrude([{ ring: [[0, 0], [10, 0], [10, 10], [0, 10]], h: 300, real: true }], 0.5);
    expect(Math.max(...m.positions.filter((_, i) => i % 3 === 1))).toBe(MAX_SHRUNK_HEIGHT);
  });
  it('builds a mesh from the saved answer, with the suggested shrink', () => {
    const m = osmToMesh(fx, fx.lat, fx.lon);
    expect(m.indices.length).toBeGreaterThan(30);
    expect(m.shrink).toBeCloseTo(suggestedShrink(buildingsFrom(fx, fx.lat, fx.lon)), 9);
    expect(m.shrink).toBeLessThanOrEqual(1);
    expect(Math.max(...m.indices)).toBeLessThan(m.positions.length / 3);
    expect(osmToMesh(fx, fx.lat, fx.lon, 0.1).positions.length).toBe(m.positions.length);
  });
});
