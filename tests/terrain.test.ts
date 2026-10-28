import { describe, expect, it } from 'vitest';
import { extrude } from '../src/world/osm';
import { fetchGround, groundAt, heightAt, lowest, relief, terrariumHeight, tileXY, type Ground, type Tile } from '../src/world/terrain';
import { bestSlices, laneToCourse, surfaceSamples } from '../src/slice/slice';
import { centred } from '../src/slice/world';
import { searchIdealRun } from '../src/sim/ideal';

const box = (x: number, w = 6, h = 3) => ({ ring: [[x, -4], [x + w, -4], [x + w, 4], [x, 4]] as [number, number][], h, real: true });

describe('terrain tiles (CC-51)', () => {
  it('decodes the Terrarium height: R*256 + G + B/256 - 32768', () => {
    expect(terrariumHeight(128, 0, 0)).toBe(0);
    expect(terrariumHeight(128, 130, 128)).toBe(130.5);
    expect(terrariumHeight(127, 255, 0)).toBe(-1);
  });
  it('puts a point in the right web-mercator tile', () => {
    const t = tileXY(0, 0, 1);
    expect([t.x, t.y]).toEqual([1, 1]); // the middle of the world is the corner of the four zoom-1 tiles
    const paris = tileXY(48.8867, 2.3431, 15);
    expect([Math.floor(paris.x), Math.floor(paris.y)]).toEqual([16597, 11268]);
  });
  it('reads the pixel a tile coordinate falls in', () => {
    const data = new Uint8Array(2 * 2 * 3); data.set([128, 10, 0], 3 * 3); // pixel (1, 1)
    const tile: Tile = { data, width: 2, channels: 3 };
    expect(heightAt(tile, 5.75, 9.75)).toBe(10);
    expect(heightAt(tile, 5.1, 9.1)).toBe(-32768); // pixel (0, 0) is all zero
  });
  it('blends between grid points and stays inside the grid', () => {
    const g: Ground = { radius: 20, step: 20, n: 3, h: [0, 0, 0, 10, 10, 10, 20, 20, 20] }; // rises 10 m per 20 m going south
    expect(groundAt(g, 0, 0)).toBeCloseTo(10, 6);
    expect(groundAt(g, 7, 10)).toBeCloseTo(15, 6);
    expect(groundAt(g, 500, 500)).toBeCloseTo(20, 1);
    expect(groundAt(null, 1, 1)).toBe(0);
    expect([relief(g), lowest(g)]).toEqual([20, 0]);
  });
  it('builds a grid from tiles (one fetch per tile, fake network)', async () => {
    const urls: string[] = [];
    const g = await fetchGround(48.8867, 2.3431, 60, async () => ({ data: new Uint8Array(256 * 256 * 3).map((_, i) => (i % 3 === 0 ? 128 : i % 3 === 1 ? 50 : 0)), width: 256, channels: 3 }), { fetcher: async (u) => { urls.push(u); return new ArrayBuffer(0); } });
    expect(g.n).toBe(7);
    expect(new Set(g.h)).toEqual(new Set([50]));
    expect(urls.length).toBe(new Set(urls).size); // never the same tile twice
    expect(urls[0]).toMatch(/elevation-tiles-prod\/terrarium\/15\/\d+\/\d+\.png$/);
  });
});

describe('a hill under the buildings', () => {
  const slope: Ground = { radius: 30, step: 20, n: 4, h: Array.from({ length: 16 }, (_, k) => 5 + 0.1 * ((k % 4) * 20 - 30)) }; // 0.1 m per metre going east: 6 m over the place
  it('lifts each roof by the hill under it, shrunk like the rest, with the lowest ground at y = 0', () => {
    const m = extrude([box(-30), box(0)], 0.5, slope);
    const roofs = [...new Set(m.positions.filter((_, i) => i % 3 === 1).map((y) => Math.round(y * 1000) / 1000))].sort((a, b) => a - b);
    expect(roofs[0]).toBe(0); // walls run down to the lowest ground
    const top = roofs[roofs.length - 1], low = roofs[roofs.length - 2];
    expect(top - low).toBeCloseTo(0.5 * 0.1 * 30, 1); // the second box is 30 m further east, so 3 m higher before the shrink
  });
  it('is unchanged without a ground', () => {
    expect(extrude([box(0)], 0.5).positions).toEqual(extrude([box(0)], 0.5, null).positions);
  });
  it('a gentle slope still gives a lane the simulator clears (roofs step up a little each time)', () => {
    const gentle: Ground = { ...slope, h: slope.h.map((_, k) => 5 + 0.04 * ((k % 4) * 20 - 30)) }; // 0.04 m per metre: each roof 10 m on is 0.4 m higher
    const bs = [-30, -20, -10, 0, 10, 20].map((x) => box(x, 6, 1.5)); // low roofs, so a plain jump can climb from one to the next
    const piece = centred(extrude(bs, 1, gentle));
    const lanes = bestSlices({ positions: surfaceSamples(piece, 80) }, { top: 3, centre: { x: 0, z: 0 } });
    expect(lanes.length).toBeGreaterThan(0);
    const c = lanes[0];
    expect(searchIdealRun(laneToCourse({ cells: [...c.profile.cells], length: c.profile.length, origin: c.profile.origin }, 'hill')).cleared).toBe(true);
  }, 180000); // a real lane search over five start levels: about a minute on a busy machine
});
