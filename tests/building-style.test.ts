import { describe, expect, it } from 'vitest';
import { buildingLook } from '../src/world/skin';
import { buildingSeed, buildingStyleOn, floorRows, PALETTES, regionOf, roofBox, roofFits, roofShapeOf, roofTriangles, shade, styleBuilding, styleDefaultOn } from '../src/world/building-style';

const st = (tags: Record<string, string>, seed = 7, h = 9, lat = 48.8, lon = 2.3) => styleBuilding(tags, seed, h, buildingLook(tags, h), lat, lon);
describe('building style from tags (CC-133)', () => {
  it('a written colour is kept; a material colour is shaded a little; neither takes a palette colour', () => {
    expect(st({ building: 'yes', 'building:colour': '#112233' }).wall).toBe('#112233');
    expect(st({ building: 'yes', 'building:material': 'brick' }, 3).wall).toBe(shade('#a4553f', 0.94 + 3 / 100));
    expect(PALETTES.cool).toContain(st({ building: 'yes' }, 40, 9, 51, 0).wall);
  });
  it('the same id gives the same look, neighbours differ', () => {
    expect(st({ building: 'house' }, 11)).toEqual(st({ building: 'house' }, 11));
    const walls = new Set(Array.from({ length: 40 }, (_, i) => st({ building: 'house' }, buildingSeed(1000 + i)).wall));
    expect(walls.size).toBeGreaterThan(3);
  });
  it('the region leans warm in the south and cool in the north', () => {
    expect(regionOf(40.4, -3.7)).toBe('warm'); expect(regionOf(59.3, 18)).toBe('cool'); expect(regionOf(40.7, -74)).toBe('cool');
  });
  it('roof shape and colour', () => {
    expect(roofShapeOf({ 'roof:shape': 'gabled' })).toBe('gabled');
    expect(roofShapeOf({ 'roof:shape': 'pyramidal' })).toBe('hipped');
    expect(roofShapeOf({})).toBe('flat');
    expect(st({ building: 'yes', 'roof:colour': '#ff0000' }).roof).toBe('#ff0000');
    expect(st({ building: 'yes', 'roof:shape': 'hipped' }).roof).not.toBe(st({ building: 'yes' }).roof);
  });
  it('floors come from levels, else from the height; the shop band needs two floors and a tall kind', () => {
    expect(floorRows({ 'building:levels': '5' })).toBe(5);
    expect(floorRows({}, 9)).toBe(3);
    expect(floorRows({ 'building:levels': '90' })).toBe(27);
    expect(floorRows({ 'building:levels': '0' }, 3)).toBe(1);
    expect(st({ building: 'apartments', 'building:levels': '4' }).band).toBe(true);
    expect(st({ building: 'house', 'building:levels': '2' }).band).toBe(false);
    expect(st({ building: 'yes', 'building:levels': '1' }).band).toBe(false);
  });
  it('glass walls get the glass pattern', () => { expect(st({ building: 'yes', 'building:material': 'glass' }).pattern).toBe('glass'); });
  it('the seed uses the id, else the first corner', () => {
    expect(buildingSeed(5)).toBe(buildingSeed('5')); expect(buildingSeed(undefined, { lat: 1, lon: 2 })).toBe(buildingSeed(undefined, { lat: 1, lon: 2 })); expect(buildingSeed(undefined)).toBe(1);
  });
  it('the switch: the word wins; otherwise on for dev and preview, off for the live site', () => {
    expect(styleDefaultOn('localhost')).toBe(true); expect(styleDefaultOn('preview.conquercourse.pages.dev')).toBe(true);
    expect(styleDefaultOn('conquercourse.pages.dev')).toBe(false); expect(styleDefaultOn('')).toBe(false);
    expect(buildingStyleOn(new URLSearchParams('bstyle=0'), 'localhost')).toBe(false);
    expect(buildingStyleOn(new URLSearchParams('bstyle=1'), 'conquercourse.pages.dev')).toBe(true);
    expect(buildingStyleOn(new URLSearchParams(''), 'localhost')).toBe(true);
  });
  const rect = (w: number, d: number, a = 0) => [[0, 0], [w, 0], [w, d], [0, d]].map(([x, z]) => ({ x: x * Math.cos(a) - z * Math.sin(a), z: x * Math.sin(a) + z * Math.cos(a) }));
  it('a roof box finds a turned rectangle and refuses an L shape', () => {
    const b = roofBox(rect(12, 6, 0.5))!;
    expect(b.len).toBeCloseTo(12, 5); expect(b.wid).toBeCloseTo(6, 5); expect(b.fill).toBeCloseTo(1, 5); expect(roofFits(b)).toBe(true);
    const L = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 4 }, { x: 4, z: 4 }, { x: 4, z: 10 }, { x: 0, z: 10 }];
    expect(roofFits(roofBox(L))).toBe(false);
  });
  it('roof triangles stay inside the box and reach the ridge height', () => {
    const b = roofBox(rect(12, 6))!;
    for (const shape of ['gabled', 'hipped'] as const) {
      const t = roofTriangles(b, shape, 5, 2), ys = t.filter((_, i) => i % 3 === 1);
      expect(Math.max(...ys)).toBeCloseTo(7, 6); expect(Math.min(...ys)).toBeCloseTo(5, 6); expect(t.length % 9).toBe(0);
      const xs = t.filter((_, i) => i % 3 === 0); expect(Math.min(...xs)).toBeGreaterThanOrEqual(-1e-6); expect(Math.max(...xs)).toBeLessThanOrEqual(12 + 1e-6);
    }
    expect(roofTriangles(b, 'gabled', 0, 1).length).toBe(6 * 9);
  });
});
