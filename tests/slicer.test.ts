import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildingsFrom, osmToMesh, type Building, type OverpassAnswer } from '../src/world/osm';
import { lowest, relief, type Ground } from '../src/world/terrain';
import { bestSlices, surfaceSamples } from '../src/slice/slice';
import { buildingTops, contourSegments, cutBuildings, cutRange, ladderLevels, ladderStep, laneLine, resample, slopeCells, toLonLat } from '../src/slice/slicer';

// a grid made from a height function, radius 60 m, step 2 m
const grid = (f: (x: number, z: number) => number, radius = 60, step = 2): Ground => {
  const n = (2 * radius) / step + 1, h: number[] = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) h.push(f(-radius + i * step, -radius + j * step));
  return { radius, step, n, h };
};
const square = (x: number, z: number, w = 10): Building => ({ ring: [[x, z], [x + w, z], [x + w, z + w], [x, z + w]], h: 30, real: true });

describe('contour lines (marching squares)', () => {
  it('a cone gives circles at the right radii', () => {
    const cone = grid((x, z) => 100 - Math.hypot(x, z));
    const segs = contourSegments(cone, 60); // 40 m below the peak: a circle of radius 40
    expect(segs.length).toBeGreaterThan(40);
    for (const s of segs) for (const [x, z] of [[s[0], s[1]], [s[2], s[3]]]) expect(Math.abs(Math.hypot(x, z) - 40)).toBeLessThan(0.5);
    const bins = new Set(segs.map((s) => Math.floor(((Math.atan2(s[1], s[0]) + Math.PI) / (2 * Math.PI)) * 36)));
    expect(bins.size).toBeGreaterThanOrEqual(34); // all the way round
  });
  it('no line above the top or below the bottom', () => {
    const cone = grid((x, z) => 100 - Math.hypot(x, z));
    expect(contourSegments(cone, 101)).toHaveLength(0);
    expect(contourSegments(cone, 10)).toHaveLength(0); // the corners of the grid are 85 m from the peak, still 15 m high
  });
  it('spacing shrinks where the slope is steeper', () => {
    // a slope rising to the south: height = s * z. Contours every 2 m are 2 / s apart.
    const spacing = (s: number) => {
      const g = grid((_x, z) => 100 + s * z);
      const zAt = (level: number) => { const seg = contourSegments(g, level); return seg.reduce((t, a) => t + (a[1] + a[3]) / 2, 0) / seg.length; };
      return zAt(100 + 2 * 3) - zAt(100 + 2 * 2);
    };
    const gentle = spacing(0.1), steep = spacing(0.4);
    expect(gentle).toBeCloseTo(20, 0);
    expect(steep).toBeCloseTo(5, 0);
    expect(steep).toBeLessThan(gentle / 3);
  });
  it('a coarse 20 m grid is resampled so lines are smooth', () => {
    const coarse = grid((x, z) => 100 - Math.hypot(x, z), 120, 20);
    const fine = resample(coarse, 4);
    expect(fine.n).toBe(61);
    expect(contourSegments(coarse, 70).length).toBeGreaterThan(30);
  });
});

describe('the contour ladder', () => {
  it('shows 6 to 10 lines for any place with enough relief', () => {
    for (const rel of [8, 12, 20, 38, 60, 100, 250, 400]) {
      const lines = ladderLevels(rel).length;
      expect(lines).toBeGreaterThanOrEqual(6);
      expect(lines).toBeLessThanOrEqual(10);
    }
    expect(ladderStep(38)).toBe(5);
    expect(ladderLevels(38)).toEqual([5, 10, 15, 20, 25, 30, 35]);
  });
});

describe('floor plans (buildings cut by the plane)', () => {
  it('a building is cut at any height up to its roof, and wholly below after that', () => {
    const tops = buildingTops([square(0, 0)], 0.2, null); // 30 m tall, shrink 0.2: the 8 m cap is 40 m real, so 30 m stays
    expect(tops).toHaveLength(1);
    expect(tops[0].top).toBeCloseTo(30, 6);
    expect(cutBuildings(tops, 20)[0].cut).toBe(true);
    expect(cutBuildings(tops, 30)[0].cut).toBe(true);
    expect(cutBuildings(tops, 31)[0].cut).toBe(false);
  });
  it('the cut gives the footprint', () => {
    const cut = cutBuildings(buildingTops([square(0, 0), square(20, 0)], 0.2, null), 12);
    expect(cut.every((b) => b.cut)).toBe(true);
    expect(cut[0].ring).toEqual([[0, 0], [10, 0], [10, 10], [0, 10]]);
  });
  it('the shrunk-height cap lowers the tallest roofs the same way the game does', () => {
    const tops = buildingTops([square(0, 0)], 0.1, null); // 8 m cap shrunk = 80 m real: a 30 m building stays 30 m
    expect(tops[0].top).toBe(30);
    const tall = buildingTops([{ ...square(0, 0), h: 200 }], 0.1, null);
    expect(tall[0].top).toBeCloseTo(80, 6); // capped at 8 / 0.1
  });
  it('on a hill the roof sits above the ground at its middle', () => {
    const hill = grid((_x, z) => 50 + 0.2 * z); // rises to the south; the lowest point is 50 - 12 = 38
    const [t] = buildingTops([square(0, 40)], 0.2, hill); // middle at z = 45: ground 59, lowest 38 -> 21 above the lowest
    expect(t.top).toBeCloseTo(21 + 30, 3);
    expect(cutRange([t], hill)).toBeGreaterThanOrEqual(Math.ceil(relief(hill)));
  });
});

describe('slope tint and map helpers', () => {
  it('reads the slope of a plane', () => {
    const cells = slopeCells(grid((_x, z) => 0.4 * z));
    expect(cells.length).toBeGreaterThan(100);
    for (const c of cells) expect(c.deg).toBeCloseTo((Math.atan(0.4) * 180) / Math.PI, 1);
    for (const c of slopeCells(grid(() => 5))) expect(c.deg).toBeCloseTo(0, 6);
  });
  it('draws the lane as a line in real metres', () => {
    const [a, b] = laneLine({ angle: 0, offset: 0, origin: -3, length: 10 }, 0.5);
    expect(a).toEqual([-6, 0]);
    expect(b[0]).toBeCloseTo(14, 6);
    const [c, d] = laneLine({ angle: Math.PI / 2, offset: 2, origin: 0, length: 4 }, 1); // along +z, sideways step 2 m to -x
    expect(c[0]).toBeCloseTo(-2, 6); expect(d[1]).toBeCloseTo(4, 6);
  });
  it('turns metres from the pin into lon and lat', () => {
    const [lon, lat] = toLonLat(48.8867, 2.3431, 100, 100);
    expect(lat).toBeLessThan(48.8867); // south is down
    expect(lon).toBeGreaterThan(2.3431);
    expect(toLonLat(10, 20, 0, 0)).toEqual([20, 10]);
  });
});

describe('Montmartre (saved answers)', () => {
  const answer = JSON.parse(readFileSync('tests/fixtures/overpass-montmartre.json', 'utf8')) as OverpassAnswer;
  const raw = JSON.parse(readFileSync('tests/fixtures/ground-montmartre.json', 'utf8')) as Ground;
  const lat = 48.8867, lon = 2.3431, k = 0.07;
  const bs = buildingsFrom(answer, lat, lon), tops = buildingTops(bs, k, raw), range = cutRange(tops, raw);
  it('the hill is 38 m high and the slider reaches above it', () => {
    expect(Math.round(relief(raw))).toBe(39);
    expect(range).toBeGreaterThanOrEqual(39);
  });
  it('fewer buildings are cut the higher the plane goes', () => {
    const count = (c: number) => cutBuildings(tops, c).filter((b) => b.cut).length;
    expect(count(0)).toBe(tops.length);
    expect(count(range / 2)).toBeLessThan(count(0));
    expect(count(range)).toBeLessThanOrEqual(count(range / 2));
  });
  it('contour lines exist inside the relief and not outside', () => {
    const fine = resample(raw, 4);
    expect(contourSegments(fine, lowest(raw) + 15, 99).length).toBeGreaterThan(10);
    expect(contourSegments(fine, lowest(raw) - 5, 99)).toHaveLength(0);
    expect(contourSegments(fine, lowest(raw) + relief(raw) + 5, 99)).toHaveLength(0);
  });
  it('the lane search (without the slow proof) finds a lane at some height', () => {
    const m = osmToMesh(answer, lat, lon, k, raw);
    const samples = surfaceSamples({ positions: m.positions, indices: m.indices }, 80);
    const levels = [3, 8, 14, 20].map((c) => c * k);
    const found = levels.map((level) => bestSlices({ positions: samples }, { levels: [level], top: 1, centre: { x: 0, z: 0 }, prove: false }));
    expect(found.some((f) => f.length > 0)).toBe(true);
  });
});
