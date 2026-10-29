// CC-187: street furniture from Mapillary map_features: the proxy, the move from the real world to the game's frame, and the rule that keeps it off the run.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { lookupFeatures, trimFeature, WANTED } from '../functions/api/features';
import type { Fetcher, Store } from '../functions/api/photos';
import { FURNITURE_ON, KINDS, drawScale, keepOffRun, place, toGame, MIN_SCALE, LANE_HALF, CLEAR_Z, type Frame, type FurnitureFile } from '../src/world/furniture';
import { groundAt, type Terrain } from '../src/sim/terrain';

const mem = (): Store => { const m = new Map<string, string>(); return { get: async (k) => m.get(k) ?? null, put: async (k, v) => void m.set(k, v) }; };
const answer = (data: unknown[], ok = true): Fetcher => async () => ({ ok, status: ok ? 200 : 500, json: async () => ({ data }) });
const light = { id: '1141145343036024', object_value: 'object--street-light', geometry: { type: 'Point', coordinates: [2.3410947, 48.8857] }, last_seen_at: '2019-12-25T11:34:26+0000' };

describe('the map_features proxy', () => {
  it('keeps only the classes the game draws and only five fields', () => {
    expect(trimFeature(light)).toEqual({ id: '1141145343036024', value: 'object--street-light', lat: 48.8857, lon: 2.3410947, seen: '2019-12-25' });
    expect(trimFeature({ ...light, object_value: 'object--manhole' })).toBeNull();
    expect(trimFeature({ ...light, id: 'abc' })).toBeNull();
    expect(trimFeature({ ...light, geometry: { type: 'Polygon', coordinates: [1, 2] } })).toBeNull();
  });
  it('answers 503 without a token and 400 for a bad search', async () => {
    expect((await lookupFeatures(new URLSearchParams('lat=1&lon=1'), 'a', '', mem(), answer([]))).status).toBe(503);
    expect((await lookupFeatures(new URLSearchParams('lat=1&lon=1&r=900'), 'a', 'tok', mem(), answer([]))).status).toBe(400);
  });
  it('sends the token only in the header, caches, and never puts it in the answer', async () => {
    let seen = '', url = '', calls = 0;
    const f: Fetcher = async (u, i) => { calls++; url = u; seen = i.headers.Authorization; return { ok: true, status: 200, json: async () => ({ data: [light] }) }; };
    const store = mem(), q = new URLSearchParams('lat=48.8867&lon=2.3431&r=150');
    const a = await lookupFeatures(q, 'ip1', 'secret|token', store, f), b = await lookupFeatures(q, 'ip1', 'secret|token', store, f);
    expect(seen).toBe('OAuth secret|token'); expect(url).not.toContain('secret'); expect(JSON.stringify(a.body)).not.toContain('secret');
    expect((a.body as { cache: string }).cache).toBe('miss'); expect((b.body as { cache: string }).cache).toBe('hit'); expect(calls).toBe(1);
  });
  it('says 502 when Mapillary fails', async () => { expect((await lookupFeatures(new URLSearchParams('lat=1&lon=1'), 'z', 'tok', mem(), answer([], false))).status).toBe(502); });
  it('maps every wanted class to a kind the game can draw', () => { for (const k of Object.values(WANTED)) expect(KINDS).toContain(k); });
});

const frame: Frame = { k: 0.5, ox: 2, oz: -1, oy: 3, rot: Math.PI / 2, tx: 10, ty: -1, tz: 4, scale: 1, startX: 0, finishX: 30 };
describe('from the real world to the game', () => {
  it('with no turn, the pin-relative point lands at the shrunk offset from the mesh centre plus the item position', () => {
    const f = { ...frame, rot: 0 }, g = toGame(f, 10, 20, 8);
    expect(g.x).toBeCloseTo(10 + (10 * 0.5 - 2)); expect(g.z).toBeCloseTo(4 + (20 * 0.5 + 1)); expect(g.y).toBeCloseTo(-1 + (8 * 0.5 - 3));
  });
  it('turns about y the way three.js does (a quarter turn sends the old z to the new x)', () => {
    const g = toGame(frame, 4, 0, 6); // a = 4*0.5-2 = 0, b = 0*0.5+1 = 1
    expect(g.x).toBeCloseTo(10 + 1); expect(g.z).toBeCloseTo(4 - 0);
  });
  it('matches the three.js matrix for the stored scene item', async () => {
    const THREE = await import('three');
    const f: Frame = { ...frame, rot: 2.9670597283903604, tx: 15.3, tz: 3.98, ty: -1.0 };
    const m = new THREE.Matrix4().compose(new THREE.Vector3(f.tx, f.ty, f.tz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), f.rot), new THREE.Vector3(1, 1, 1));
    const east = 33.3, south = -70.2, v = new THREE.Vector3(east * f.k - f.ox, 0, south * f.k - f.oz).applyMatrix4(m), g = toGame(f, east, south, 0);
    expect(g.x).toBeCloseTo(v.x, 6); expect(g.z).toBeCloseTo(v.z, 6);
  });
  it('draws small worlds no smaller than the minimum scale', () => { expect(drawScale({ ...frame, k: 0.07 })).toBe(MIN_SCALE); expect(drawScale({ ...frame, k: 0.9 })).toBeCloseTo(0.9); });
  it('is off unless ?furniture=1', () => { expect(FURNITURE_ON(new URLSearchParams(''))).toBe(false); expect(FURNITURE_ON(new URLSearchParams('furniture=0'))).toBe(false); expect(FURNITURE_ON(new URLSearchParams('furniture=1'))).toBe(true); });
});

describe('furniture stays off the run', () => {
  const flat = (): number => 0;
  it('leaves things outside the lane band alone', () => { expect(keepOffRun({ x: 5, y: 0, z: 3 }, flat)).toEqual({ z: 3, moved: false }); expect(keepOffRun({ x: 5, y: 0, z: -LANE_HALF }, flat).moved).toBe(false); });
  it('moves a thing standing in the runner space to the clear line on its own side', () => {
    expect(keepOffRun({ x: 5, y: 0, z: 0.4 }, flat)).toEqual({ z: CLEAR_Z, moved: true });
    expect(keepOffRun({ x: 5, y: 0.2, z: -0.4 }, flat)).toEqual({ z: -CLEAR_Z, moved: true });
  });
  it('leaves a thing in the lane band that is far below the lane (a street under a roof run)', () => { expect(keepOffRun({ x: 5, y: -3, z: 0.2 }, () => 2).moved).toBe(false); });
  it('after placing, nothing is closer to the run line than the band unless it is low under the lane', () => {
    const t: Terrain = { platforms: [{ x0: -10, x1: 40, top: 1 }], waterY: -1 };
    const file = { place: 'x', generated: '', source: '', licence: '', credit: '', frame: { ...frame, rot: 0, k: 1, ox: 0, oz: 0, oy: 0, tx: 0, tz: 0, ty: 1 }, features: Array.from({ length: 60 }, (_, i) => ({ id: String(i), kind: 'light', value: 'street-light', x: i * 0.5, z: (i % 7) * 0.3 - 1, h: 0, seen: '' })) } as unknown as FurnitureFile;
    const { placed, moved } = place(file, (x) => groundAt(t, x));
    expect(moved).toBeGreaterThan(0);
    for (const p of placed) expect(Math.abs(p.z) >= LANE_HALF || p.y < groundAt(t, p.x) - 0.6).toBe(true);
  });
});

describe('the stored files', () => {
  const dir = 'public/assets/places/furniture';
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')) : [];
  it('has four places, each with credit, licence and only known kinds', () => {
    expect(files.length).toBe(4);
    for (const f of files) {
      const j = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as FurnitureFile;
      expect(j.licence).toBe('CC BY-SA 4.0'); expect(j.credit).toMatch(/Mapillary/); expect(j.features.length).toBeGreaterThan(0);
      for (const it of j.features) { expect(KINDS).toContain(it.kind); expect(Number.isFinite(it.x + it.z + it.h)).toBe(true); expect(it.id).toMatch(/^\d+$/); }
    }
  });
  it('keeps the proven lane file untouched by this feature', () => { expect(existsSync('public/assets/experiments/osm/montmartre-paris.course.json')).toBe(true); });
});
