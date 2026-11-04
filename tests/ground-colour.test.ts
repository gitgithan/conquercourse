import { describe, expect, it } from 'vitest';
import { areaZone, groundColourOn, hexToRgb, lineZone, paintGround, slopeDeg, slopeShade, ZONE_HEX, ZONE_RGB, type PaintElement } from '../src/slice/ground-colour';

// a tiny flat world: the pin is at lat 0, lon 0; x is east, z is south, in metres (about 1 / 111320 degrees)
const M = 111320;
const project = (p: { lat: number; lon: number }) => ({ x: p.lon * M, z: -p.lat * M });
const pt = (x: number, z: number) => ({ lat: -z / M, lon: x / M });
const box = (x0: number, z0: number, x1: number, z1: number) => [pt(x0, z0), pt(x1, z0), pt(x1, z1), pt(x0, z1), pt(x0, z0)];
const at = (p: ReturnType<typeof paintGround>, x: number, z: number) => { const i = Math.floor((x + p.half) / p.cell), j = Math.floor((z + p.half) / p.cell), k = (j * p.size + i) * 4; return [p.rgba[k], p.rgba[k + 1], p.rgba[k + 2]]; };
const close = (a: number[], b: number[], tol = 3) => a.every((v, i) => Math.abs(v - b[i]) <= tol);

describe('tags to zones', () => {
  it('maps the common tags', () => {
    expect(areaZone({ natural: 'water' })).toBe('water');
    expect(areaZone({ leisure: 'park' })).toBe('lawn');
    expect(areaZone({ landuse: 'grass' })).toBe('grass');
    expect(areaZone({ landuse: 'forest' })).toBe('wood');
    expect(areaZone({ natural: 'beach' })).toBe('sand');
    expect(areaZone({ leisure: 'playground' })).toBe('sports');
    expect(areaZone({ leisure: 'pitch', surface: 'grass' })).toBe('grass');
    expect(areaZone({ leisure: 'pitch', surface: 'concrete' })).toBe('paving');
    expect(areaZone({ leisure: 'playground', surface: 'woodchips' })).toBe('gravel');
    expect(areaZone({ amenity: 'parking' })).toBe('asphalt');
    expect(areaZone({ amenity: 'parking', surface: 'gravel' })).toBe('gravel');
    expect(areaZone({ highway: 'pedestrian', area: 'yes' })).toBe('paving');
    expect(areaZone({ landuse: 'residential' })).toBe('built');
  });
  it('says nothing for tags that do not describe the ground', () => {
    expect(areaZone({})).toBeNull();
    expect(areaZone(undefined)).toBeNull();
    expect(areaZone({ building: 'yes' })).toBeNull();
    expect(areaZone({ highway: 'residential' })).toBeNull(); // a street is a line, not an area
  });
  it('maps streets and paths with a width', () => {
    expect(lineZone({ highway: 'primary' })).toEqual({ zone: 'asphalt', width: 11 });
    expect(lineZone({ highway: 'footway' })?.zone).toBe('paving');
    expect(lineZone({ highway: 'path', surface: 'gravel' })?.zone).toBe('gravel');
    expect(lineZone({ highway: 'residential', surface: 'cobblestone' })?.zone).toBe('paving');
    expect(lineZone({ highway: 'service', width: '4' })?.width).toBe(4);
    expect(lineZone({ highway: 'service', width: '400' })?.width).toBe(6);
    expect(lineZone({ highway: 'proposed' })).toBeNull();
    expect(lineZone({})).toBeNull();
  });
  it('every zone has a hex colour that parses', () => {
    for (const [z, hex] of Object.entries(ZONE_HEX)) { expect(hex, z).toMatch(/^#[0-9a-f]{6}$/); expect(ZONE_RGB[z as keyof typeof ZONE_RGB]).toEqual(hexToRgb(hex)); }
  });
});

describe('slope shade', () => {
  it('leaves flat ground alone and darkens steep ground, more with more slope', () => {
    const c = hexToRgb(ZONE_HEX.grass);
    expect(slopeShade(c, 0)).toEqual(c);
    const a = slopeShade(c, 10), b = slopeShade(c, 25);
    expect(a[1]).toBeLessThan(c[1]); expect(b[1]).toBeLessThan(a[1]);
    expect(slopeShade(c, 80)).toEqual(slopeShade(c, 30)); // it stops getting darker
  });
  it('reads the slope of a height grid, and none without one', () => {
    const n = 11, step = 20, h: number[] = []; for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) h.push(i * step * 0.5); // rises 1 m per 2 m going east
    const g = { radius: 100, step, n, h };
    expect(slopeDeg(g, 0, 0)).toBeCloseTo(Math.atan(0.5) * 180 / Math.PI, 1);
    expect(slopeDeg(null, 0, 0)).toBe(0);
    expect(slopeDeg({ radius: 100, step, n, h: h.map(() => 5) }, 10, 10)).toBe(0);
  });
});

describe('painting the ground', () => {
  const park: PaintElement = { type: 'way', tags: { leisure: 'park' }, geometry: box(-20, -20, 0, 20) };
  const pond: PaintElement = { type: 'way', tags: { natural: 'water' }, geometry: box(-10, -10, 10, 10) };
  it('falls back to the flat ground colour where no tag covers a spot', () => {
    const p = paintGround([park], { half: 40, project });
    expect(at(p, 30, 30)).toEqual(ZONE_RGB.base);
    expect(paintGround([], { half: 40, project }).counts.base).toBe(p.size * p.size);
  });
  it('paints the inside of an area in its colour, far from any edge', () => {
    const p = paintGround([park], { half: 40, project });
    expect(close(at(p, -15, 0), ZONE_RGB.lawn, 1)).toBe(true);
  });
  it('puts water on top of a park, whatever the order in the list', () => {
    const a = paintGround([park, pond], { half: 40, project }), b = paintGround([pond, park], { half: 40, project });
    expect(close(at(a, -5, 0), ZONE_RGB.water, 1)).toBe(true);
    expect(Array.from(a.rgba)).toEqual(Array.from(b.rgba));
  });
  it('melts an edge over a metre or two, with no hard step', () => {
    const p = paintGround([park], { half: 40, project, cell: 0.5, blurM: 1.2 });
    const row: number[] = []; for (let x = -3; x <= 3; x += 0.5) row.push(at(p, x + 0.25, 0)[0]); // across the park edge at x = 0
    const steps = row.slice(1).map((v, i) => Math.abs(v - row[i]));
    const jump = ZONE_RGB.lawn[0] - ZONE_RGB.base[0];
    expect(Math.max(...steps)).toBeLessThan(Math.abs(jump) * 0.6); // no single step is most of the change
    expect(row.some((v) => v !== row[0] && v !== row[row.length - 1])).toBe(true); // there are in-between colours
    expect(close(at(p, -8, 0), ZONE_RGB.lawn, 1) && close(at(p, 8, 0), ZONE_RGB.base, 1)).toBe(true); // and it is pure again a few metres away
  });
  it('draws streets as ribbons of their width, and not over water', () => {
    const street: PaintElement = { type: 'way', tags: { highway: 'residential' }, geometry: [pt(-30, 25), pt(30, 25)] };
    const p = paintGround([street], { half: 40, project, blurM: 0 });
    expect(close(at(p, 0, 25), ZONE_RGB.asphalt, 1)).toBe(true);
    expect(at(p, 0, 25 + 3.6)).toEqual(ZONE_RGB.base);
    const over: PaintElement = { type: 'way', tags: { highway: 'residential' }, geometry: [pt(-30, 0), pt(30, 0)] };
    const q = paintGround([pond, over], { half: 40, project, blurM: 0 });
    expect(at(q, 0, 0)).toEqual(ZONE_RGB.water);
    expect(close(at(q, 20, 0), ZONE_RGB.asphalt, 1)).toBe(true);
  });
  it('shades a slope and does not touch a flat spot', () => {
    const n = 11, step = 20, h: number[] = []; for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) h.push(i * step * 0.5);
    const flat = paintGround([park], { half: 40, project, ground: { radius: 100, step, n, h: h.map(() => 3) } }), plain = paintGround([park], { half: 40, project });
    const sloped = paintGround([park], { half: 40, project, ground: { radius: 100, step, n, h } });
    expect(Array.from(flat.rgba)).toEqual(Array.from(plain.rgba));
    expect(at(sloped, -15, 0)[1]).toBeLessThan(at(plain, -15, 0)[1]);
  });
  it('is the same every time and makes opaque pixels', () => {
    const a = paintGround([park, pond], { half: 40, project }), b = paintGround([park, pond], { half: 40, project });
    expect(Array.from(a.rgba)).toEqual(Array.from(b.rgba));
    expect(a.rgba.filter((_, i) => i % 4 === 3).every((v) => v === 255)).toBe(true);
  });
  it('holds the raster to 1024 pixels a side for a large place', () => {
    expect(paintGround([], { half: 400, project }).size).toBeLessThanOrEqual(1024);
  });
});

describe('the switch', () => {
  const q = (s: string) => new URLSearchParams(s);
  it('is on in dev and on the preview site, off on the real site and in tests', () => {
    expect(groundColourOn(q(''), 'localhost')).toBe(true);
    expect(groundColourOn(q(''), 'preview.conquercourse.pages.dev')).toBe(true);
    expect(groundColourOn(q(''), 'conquercourse.pages.dev')).toBe(false);
    expect(groundColourOn(q(''))).toBe(false);
  });
  it('is decided by the word when it is given', () => {
    expect(groundColourOn(q('groundcolour=1'), 'conquercourse.pages.dev')).toBe(true);
    expect(groundColourOn(q('groundcolour=0'), 'localhost')).toBe(false);
  });
});
