import { describe, expect, it } from 'vitest';
import { coneRing, dotsGeoJSON, nearest, photoDotsOn, DOTS_MAX, CONE_M } from '../src/world/photo-dots';
import { positionOf, trim } from '../functions/api/photos';
import type { AllowedPhoto } from '../src/world/live-photos';

const P = (id: string, lat: number, lon: number, compass: number | null = 90): AllowedPhoto => ({ id, creator: 'x', capturedAt: null, lat, lon, compass });

describe('photo dots (CC-133)', () => {
  it('prefers the corrected position and falls back to the camera position', () => {
    expect(positionOf({ computed_geometry: { coordinates: [-3.189326, 55.948702] }, geometry: { coordinates: [-3.1893, 55.9486] } })).toEqual({ lat: 55.948702, lon: -3.189326 });
    expect(positionOf({ geometry: { coordinates: [-3.1893, 55.9486] } })).toEqual({ lat: 55.9486, lon: -3.1893 });
    expect(positionOf({ computed_geometry: { coordinates: [NaN, 5] }, geometry: { coordinates: [1, 2] } })).toEqual({ lat: 2, lon: 1 });
    expect(positionOf({})).toEqual({ lat: null, lon: null });
    expect(positionOf({ geometry: { coordinates: [10, 95] } })).toEqual({ lat: null, lon: null });
  });
  it('the API keeps its old fields and adds the position', () => {
    const t = trim({ id: '12345678', thumb_1024_url: 'https://x/y.jpg', creator: { username: 'pbb' }, captured_at: 5, compass_angle: 14.8, computed_compass_angle: 343.8, computed_geometry: { coordinates: [-3.18, 55.94] } });
    expect(t).toEqual({ id: '12345678', thumb: 'https://x/y.jpg', creator: 'pbb', capturedAt: 5, compass: 343.8, lat: 55.94, lon: -3.18 });
  });
  it('the cone is a fan about the compass angle, the right length, from the photo spot', () => {
    for (const [compass, dx, dy] of [[0, 0, 1], [90, 1, 0], [180, 0, -1], [270, -1, 0]] as const) {
      const ring = coneRing(48, 2, compass), k = 111320;
      expect(ring[0]).toEqual([2, 48]); expect(ring[ring.length - 1]).toEqual([2, 48]);
      const mid = ring[3], ex = (mid[0] - 2) * k * Math.cos((48 * Math.PI) / 180), ny = (mid[1] - 48) * k;
      expect(ex).toBeCloseTo(dx * CONE_M, 3); expect(ny).toBeCloseTo(dy * CONE_M, 3);
    }
    const r = coneRing(0, 0, 0); expect(r[1][0]).toBeLessThan(0); expect(r[5][0]).toBeGreaterThan(0); // fans out left and right of north
  });
  it('keeps at most the nearest 200 and makes a cone only where the direction is known', () => {
    const list = Array.from({ length: 500 }, (_, i) => P(String(10000000 + i), 50 + i * 1e-4, 8));
    const got = nearest(list, 50, 8);
    expect(got).toHaveLength(DOTS_MAX); expect(got[0].id).toBe('10000000'); expect(got.map((p) => p.id)).toContain('10000199'); expect(got.map((p) => p.id)).not.toContain('10000200');
    const g = dotsGeoJSON([P('10000001', 1, 1), P('10000002', 1, 1, null)]);
    expect(g.dots.features).toHaveLength(2); expect(g.cones.features).toHaveLength(1);
  });
  it('the switch: off on the real site, on while testing, the word wins', () => {
    const q = (s: string) => new URLSearchParams(s);
    expect(photoDotsOn(q(''), 'conquercourse.pages.dev')).toBe(false);
    expect(photoDotsOn(q(''), 'localhost')).toBe(true);
    expect(photoDotsOn(q(''), 'preview.conquercourse.pages.dev')).toBe(true);
    expect(photoDotsOn(q('photodots=1'), 'conquercourse.pages.dev')).toBe(true);
    expect(photoDotsOn(q('photodots=0'), 'localhost')).toBe(false);
  });
});
