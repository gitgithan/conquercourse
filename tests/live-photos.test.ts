// CC-90: street photos that follow the runner along a real place: the lane-to-map mapping, the allow-list lookup, the throttle, the proxy and the data files.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LIMITS, lookup, trim, type Fetcher, type Store } from '../functions/api/photos';
import {
  angDiff, bearing, cellKey, createLive, LICENCE, MAX_SHOWN, pickPhotos, progressOf, spotAt, Throttle, toLatLon, toXY,
  type AllowedPhoto, type AllowList, type PlaceLine, type Thumb,
} from '../src/world/live-photos';

const place: PlaceLine = { lat: 55.9496, lon: -3.1904, lane: { line: [0, 0, 100, 0] } }; // a lane 100 m due east of the pin
const photoAt = (id: string, x: number, y: number, compass: number | null): AllowedPhoto => {
  const ll = toLatLon(place.lat, place.lon, { x, y });
  return { id, creator: 'someone', capturedAt: Date.UTC(2024, 5, 1), lat: ll.lat, lon: ll.lon, compass };
};

describe('the lane on the map', () => {
  it('turns metres east and south of the pin into latitude and longitude and back', () => {
    const ll = toLatLon(place.lat, place.lon, { x: 80, y: -30 });
    expect(ll.lat).toBeGreaterThan(place.lat); // north of the pin
    expect(ll.lon).toBeGreaterThan(place.lon); // east of the pin
    const back = toXY(place.lat, place.lon, ll.lat, ll.lon);
    expect(back.x).toBeCloseTo(80, 6); expect(back.y).toBeCloseTo(-30, 6);
  });
  it('walks the lane line from its first end to its second as the runner goes from start to finish', () => {
    const course = { startX: 0, finishX: 28.7 };
    expect(progressOf(course, 0)).toBe(0);
    expect(progressOf(course, 14.35)).toBeCloseTo(0.5, 9);
    expect(progressOf(course, 99)).toBe(1); expect(progressOf(course, -5)).toBe(0);
    expect(spotAt(place, 0)).toEqual({ x: 0, y: 0 });
    expect(spotAt(place, 0.5)).toEqual({ x: 50, y: 0 });
    expect(spotAt(place, 2)).toEqual({ x: 100, y: 0 });
  });
  it('reads compass bearings with north up and y pointing south', () => {
    expect(bearing({ x: 0, y: 0 }, { x: 0, y: -10 })).toBeCloseTo(0, 9); // north
    expect(bearing({ x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(90, 9); // east
    expect(bearing({ x: 0, y: 0 }, { x: 0, y: 10 })).toBeCloseTo(180, 9); // south
    expect(angDiff(350, 10)).toBe(20);
  });
});

describe('which allowed photos show', () => {
  const spot = { x: 50, y: 0 };
  it('keeps the near photos whose camera points at the runner, nearest first, at most three', () => {
    const list = [
      photoAt('100002', 50, -30, 180), // 30 m north, looking south at the runner: yes
      photoAt('100001', 50, -10, 180), // 10 m north: yes, nearest
      photoAt('100003', 50, -20, 0), // looking away: no
      photoAt('100004', 50, -90, 180), // too far: no
      photoAt('100005', 50, 40, null), // no camera direction: no
      photoAt('100006', 50, 50, 0), // 50 m south, looking north at the runner: yes
      photoAt('100007', 60, -15, 200), // within 60 degrees of the runner direction: yes (fourth, cut)
    ];
    const got = pickPhotos(list, place, spot);
    expect(got.map((p) => p.id)).toEqual(['100001', '100007', '100002']);
    expect(got.length).toBeLessThanOrEqual(MAX_SHOWN);
  });
  it('shows nothing where no allowed photo is near', () => { expect(pickPhotos([photoAt('100009', 0, -300, 180)], place, spot)).toEqual([]); });
});

describe('the throttle and the cache', () => {
  it('asks again only after 2 s and 15 m, both', () => {
    const t = new Throttle();
    expect(t.ready(0, { x: 0, y: 0 })).toBe(true);
    expect(t.ready(1000, { x: 30, y: 0 })).toBe(false); // far enough, too soon
    expect(t.ready(5000, { x: 5, y: 0 })).toBe(false); // late enough, too near
    expect(t.ready(5000, { x: 16, y: 0 })).toBe(true);
  });
  it('shares one answer inside a 20 m cell', () => {
    expect(cellKey({ x: 1, y: 1 })).toBe(cellKey({ x: 19, y: 19 }));
    expect(cellKey({ x: 1, y: 1 })).not.toBe(cellKey({ x: 21, y: 1 }));
  });
});

describe('the live strip', () => {
  const allow: AllowList = { place: 'test-place', name: 'Test place', generated: '2026-10-29', source: 'test', photos: [photoAt('200001', 50, -10, 180), photoAt('200002', 10, -10, 180)] };
  const course = { startX: 0, finishX: 100 };
  const thumbFor = (id: string): Thumb => ({ id, thumb: `https://example.invalid/${id}.jpg`, creator: 'alice', capturedAt: Date.UTC(2019, 0, 1) });
  it('shows the credited photo near the runner, changes as the runner moves, and asks the service only for new photos', async () => {
    let clock = 0; const asked: string[][] = []; const shown: (string[] | null)[] = [];
    const live = createLive({
      place, allow, course, now: () => clock,
      resolve: async (ids) => { asked.push(ids); return ids.map(thumbFor); },
      show: (d) => shown.push(d ? d.photos.map((p) => p.title) : null),
    });
    clock = 0; await live.update(50);
    clock = 3000; await live.update(52); // too near to ask again
    clock = 6000; await live.update(10);
    clock = 9000; await live.update(50); // back: the first photo's picture address is remembered
    expect(shown).toEqual([['Mapillary photo 200001'], ['Mapillary photo 200002'], ['Mapillary photo 200001']]);
    expect(asked).toEqual([['200001'], ['200002']]);
  });
  it('credits the creator, the licence and the Mapillary page', async () => {
    let got: ReturnType<typeof Object> | null = null;
    const live = createLive({ place, allow, course, resolve: async (ids) => ids.map(thumbFor), show: (d) => { got = d; } });
    await live.update(50);
    const p = (got as unknown as { photos: { author: string; licence: string; licenceUrl: string; source: string; file: string }[]; note: string }).photos[0];
    expect(p.author).toBe('alice'); expect(p.licence).toBe(LICENCE.name); expect(p.licenceUrl).toBe(LICENCE.url);
    expect(p.source).toBe('https://www.mapillary.com/app/?pKey=200001'); expect(p.file).toMatch(/^https:\/\//);
    expect((got as unknown as { note: string }).note).toMatch(/Mapillary/);
  });
  it('falls back to the stored strip (show null) when the service fails, and tries again later', async () => {
    let clock = 0, fail = true; const shown: (number | null)[] = [];
    const live = createLive({ place, allow, course, now: () => clock, resolve: async (ids) => (fail ? null : ids.map(thumbFor)), show: (d) => shown.push(d ? d.photos.length : null) });
    clock = 0; await live.update(50);
    fail = false; clock = 5000; await live.update(20); clock = 10000; await live.update(50);
    expect(shown[0]).toBeNull(); expect(shown.at(-1)).toBe(1);
  });
});

describe('/api/photos', () => {
  const memory = (): Store & { n: number } => { const m = new Map<string, string>(); return { n: 0, async get(k) { return m.get(k) ?? null; }, async put(k, v) { this.n++; m.set(k, v); } }; };
  const graph = (calls: string[]): Fetcher => async (url) => {
    calls.push(url);
    const id = /graph\.mapillary\.com\/(\d+)\?/.exec(url)?.[1];
    return { ok: true, status: 200, json: async () => (id ? { id, thumb_1024_url: `https://cdn.example/${id}.jpg`, creator: { username: 'bob', id: 'secret-id' }, captured_at: 1, compass_angle: 90, geometry: { x: 1 }, sequence: 'abc' } : { data: [] }) };
  };
  it('answers with the five fields only, and never with the token', async () => {
    const calls: string[] = []; const r = await lookup(new URLSearchParams('id=12345678'), 'ip-a', 'MLY|secret|token', memory(), graph(calls));
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ photos: [{ id: '12345678', thumb: 'https://cdn.example/12345678.jpg', creator: 'bob', capturedAt: 1, compass: 90 }], cache: 'miss' });
    expect(JSON.stringify(r.body)).not.toMatch(/secret|MLY|OAuth/);
  });
  it('refuses a missing token, bad ids, too many ids and a huge search', async () => {
    const s = memory(), f = graph([]);
    expect((await lookup(new URLSearchParams('id=12345678'), 'ip-b', '', s, f)).status).toBe(503);
    expect((await lookup(new URLSearchParams('id=abc'), 'ip-b', 'T', s, f)).status).toBe(400);
    expect((await lookup(new URLSearchParams('id=11111,22222,33333,44444'), 'ip-b', 'T', s, f)).status).toBe(400);
    expect((await lookup(new URLSearchParams('lat=55.9&lon=-3.1&r=5000'), 'ip-b', 'T', s, f)).status).toBe(400);
  });
  it('keeps an answer so the second ask costs nothing, and limits one address', async () => {
    const calls: string[] = [], s = memory(), f = graph(calls);
    await lookup(new URLSearchParams('id=22222222'), 'ip-c', 'T', s, f);
    const again = await lookup(new URLSearchParams('id=22222222'), 'ip-c', 'T', s, f);
    expect((again.body as { cache: string }).cache).toBe('hit'); expect(calls.length).toBe(1);
    let last = 200;
    for (let i = 0; i < LIMITS.id + 2; i++) last = (await lookup(new URLSearchParams(`id=3${String(i).padStart(7, '0')}`), 'ip-d', 'T', memory(), f)).status;
    expect(last).toBe(429);
  });
  it('drops answers without a safe picture address', () => {
    expect(trim({ id: '12345', thumb_1024_url: 'http://insecure/x.jpg' })).toBeNull();
    expect(trim({ id: 'x', thumb_1024_url: 'https://ok/x.jpg' })).toBeNull();
  });
});

describe('the allow-list files', () => {
  const dir = 'public/assets/photos-live';
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json') : [];
  it('has a list for the first places', () => { expect(files).toContain('edinburgh-old-town.json'); });
  for (const f of files) {
    it(`${f}: ids, positions near the place and no picture addresses or token`, () => {
      const raw = readFileSync(`${dir}/${f}`, 'utf8'), d = JSON.parse(raw) as AllowList;
      const pl = JSON.parse(readFileSync(`public/assets/places/${f}`, 'utf8')) as PlaceLine;
      expect(d.photos.length).toBeGreaterThan(0);
      expect(new Set(d.photos.map((p) => p.id)).size).toBe(d.photos.length);
      for (const p of d.photos) {
        expect(p.id).toMatch(/^\d{5,20}$/);
        const at = toXY(pl.lat, pl.lon, p.lat, p.lon);
        expect(Math.hypot(at.x, at.y)).toBeLessThan(400);
        expect(p.compass).not.toBeNull(); expect(p.compass!).toBeGreaterThanOrEqual(0); expect(p.compass!).toBeLessThan(360.0001);
      }
      expect(raw).not.toMatch(/https?:|MLY\||OAuth/); // no picture addresses (they expire) and no token
    });
  }
  it('has a row in ASSETS.md', () => { expect(readFileSync('docs/ASSETS.md', 'utf8')).toMatch(/photos-live/); });
});
