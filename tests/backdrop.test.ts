import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { behindLane, place2game, rigidError, rigidFrame, toCourse, uToX, type BackdropFrame } from '../src/world/backdrop';
import { toGame } from '../src/world/furniture';
import { buildingsFrom, extrude } from '../src/world/osm';
import type { SkinOsm } from '../src/world/skin';
import { laneSamples } from '../src/slice/slice';

const load = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;
const frame = load<BackdropFrame>('public/assets/demo/hero-montmartre-paris.backdrop.json');
const hero = load<{ terrain: { platforms: { x0: number; x1: number; top: number }[] } }>('public/assets/demo/hero-montmartre-paris.course.json');
const place = load<{ lat: number; lon: number; radius: number; answer: never; ground: { step: number; n: number; h: number[] } }>('public/assets/places/montmartre-paris.json');

describe('the hero lane backdrop frame (CC-234)', () => {
  it('maps u to x through the runs of ground, squeezed gaps included', () => {
    for (const r of frame.uMap) { expect(uToX(frame.uMap, r.u0)).toBeCloseTo(r.x0, 6); expect(uToX(frame.uMap, r.u1)).toBeCloseTo(r.x0 + (r.u1 - r.u0), 6); }
    let last = -Infinity;
    for (let u = -20; u < 20; u += 0.5) { const x = uToX(frame.uMap, u); expect(x).toBeGreaterThanOrEqual(last); last = x; }
  });

  it('the rigid frame (used for the street furniture and the building group) stays within 0.3 m of the exact map along the lane', () => {
    expect(rigidError(frame)).toBeLessThan(0.3);
    for (const r of frame.uMap) {
      const e = 20, s = -10, a = toCourse(frame, e, s, frame.lowest + 5), g = toGame(rigidFrame(frame), e, s, frame.lowest + 5);
      expect(Math.abs(a.y - g.y)).toBeLessThan(1e-9);
      expect(Math.abs(a.z - g.z)).toBeLessThan(1e-9);
      expect(r.u1).toBeGreaterThan(r.u0);
    }
  });

  it('roofs under the lane stand at the heights of the platforms the course was cut from', () => {
    const ground = { radius: place.radius, ...place.ground };
    const bs = buildingsFrom(place.answer, place.lat, place.lon);
    const m = extrude(bs, frame.k, ground);
    // the same dense read of the lane the course was cut from (the roofs have only corner vertices)
    const strip = laneSamples({ positions: m.positions, indices: m.indices }, { angle: frame.angle, offset: frame.offset }, { x: frame.cx, z: frame.cz });
    const platforms = hero.terrain.platforms;
    let checked = 0;
    for (const r of frame.uMap) {
      const p = platforms.find((q) => Math.abs(q.x0 - r.x0) < 0.2)!;
      let top = -Infinity;
      for (let i = 0; i < strip.length; i += 3) {
        const e = strip[i] / frame.k, s = strip[i + 2] / frame.k;
        const { u, v } = place2game(frame, e, s);
        if (Math.abs(v) > 1 || u < r.u0 || u > r.u1) continue;
        top = Math.max(top, strip[i + 1] - frame.level);
      }
      expect(Math.abs(top - p.top)).toBeLessThan(0.15);
      checked++;
    }
    expect(checked).toBe(frame.uMap.length);
  });

  it('keeps only buildings clear behind the lane', () => {
    const mLat = 111320, mLon = mLat * Math.cos((place.lat * Math.PI) / 180);
    const sq = (e: number, so: number) => ({ type: 'way' as const, tags: { building: 'yes' }, geometry: [[0, 0], [0, 5], [5, 5], [5, 0], [0, 0]].map(([de, ds]) => ({ lat: place.lat - (so + ds) / mLat, lon: place.lon + (e + de) / mLon })) });
    const front = sq(-150, -150), behind = sq(60, 0);
    expect(place2game(frame, -150, -150).v).toBeGreaterThan(5);
    expect(place2game(frame, 60, 0).v).toBeLessThan(-5);
    const osm: SkinOsm = { lat: place.lat, lon: place.lon, radius: 120, elements: [front, behind, { type: 'way', tags: { highway: 'footway' }, geometry: front.geometry }] };
    const out = behindLane(osm, frame, { gap: 2, depth: 400, reach: 400 });
    expect(out.elements).toEqual([behind]);
  });
});
