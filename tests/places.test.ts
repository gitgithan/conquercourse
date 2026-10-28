import { describe, expect, it } from 'vitest';
import { askMirrors, buildingsQuery, nearestReady, parseRequest, placeKey, trimAnswer, type ReadyIndexEntry } from '../src/world/places';
import { lookup, limited } from '../functions/api/places';
import { buildingsFrom, type OverpassAnswer } from '../src/world/osm';
import { laneForPlace } from '../src/world/place-lane';

const answer = (n: number): OverpassAnswer => ({
  elements: Array.from({ length: n }, (_, i) => ({
    type: 'way' as const, tags: { building: 'yes', height: String(6 + i), name: 'x', 'addr:street': 'y' },
    geometry: [0, 0.00004, 0.00004, 0].map((dx, k) => ({ lat: 48.8867 + (k === 2 || k === 3 ? 0.00003 : 0), lon: 2.3431 + i * 0.00006 + dx + 0.123456789 * 0 })),
  })),
});
const reply = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
const never = (signal?: AbortSignal | null) => new Promise<Response>((_, rej) => signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))));

describe('places: the question and the key', () => {
  it('rounds a pin so two pins a few metres apart share one answer', () => {
    expect(placeKey({ lat: 48.88671, lon: 2.34312, radius: 120 })).toBe(placeKey({ lat: 48.88674, lon: 2.34314, radius: 124 }));
    expect(placeKey({ lat: 48.8867, lon: 2.3431, radius: 120 })).not.toBe(placeKey({ lat: 48.8867, lon: 2.3431, radius: 200 }));
  });
  it('refuses bad requests with a plain reason', () => {
    expect(typeof parseRequest(new URLSearchParams('lat=999&lon=0&r=120'))).toBe('string');
    expect(typeof parseRequest(new URLSearchParams('lat=1&lon=1&r=5000'))).toBe('string');
    expect(typeof parseRequest(new URLSearchParams('lat=abc&lon=1'))).toBe('string');
    expect(parseRequest(new URLSearchParams('lat=48.88671&lon=2.34312&r=124'))).toEqual({ lat: 48.8867, lon: 2.3431, radius: 120 });
  });
  it('the query asks for buildings around the pin, with a time limit', () => {
    expect(buildingsQuery(1.5, 2.5, 120)).toContain('around:120,1.5,2.5');
    expect(buildingsQuery(1.5, 2.5, 120, 60)).toContain('[timeout:60]');
  });
  it('trims an answer to what buildings need', () => {
    const t = trimAnswer(answer(3));
    expect(t.elements).toHaveLength(3);
    for (const e of t.elements) expect(Object.keys(e.tags ?? {})).toEqual(['building', 'height']);
  });
});

describe('places: all servers at once, the first good answer wins', () => {
  it('returns the fast good answer while slow and broken servers lose', async () => {
    const seen: string[] = [];
    const fetcher = ((url: string, init?: RequestInit) => {
      seen.push(url);
      if (url.includes('slow')) return never(init?.signal);
      if (url.includes('broken')) return reply({ error: 'x' }, 502);
      if (url.includes('remark')) return reply({ elements: [], remark: 'runtime error: Query timed out' });
      return reply(answer(2));
    }) as unknown as typeof fetch;
    const got = await askMirrors({ lat: 1, lon: 2, radius: 120 }, { fetcher, mirrors: ['https://slow.example/x', 'https://broken.example/x', 'https://remark.example/x', 'https://good.example/x'], timeoutMs: 2000 });
    expect(got.mirror).toBe('good.example');
    expect(got.answer.elements).toHaveLength(2);
    expect(seen).toHaveLength(4); // all four were asked, none one after another
  });
  it('says what went wrong when none answers', async () => {
    const fetcher = (() => reply({}, 500)) as unknown as typeof fetch;
    await expect(askMirrors({ lat: 1, lon: 2, radius: 120 }, { fetcher, mirrors: ['https://a.example/x', 'https://b.example/x'], timeoutMs: 500 })).rejects.toThrow(/no map server answered/);
  });
  it('gives up on a server that hangs after the time limit', async () => {
    const t0 = Date.now();
    const fetcher = ((_: string, init?: RequestInit) => never(init?.signal)) as unknown as typeof fetch;
    await expect(askMirrors({ lat: 1, lon: 2, radius: 120 }, { fetcher, mirrors: ['https://hang.example/x'], timeoutMs: 150 })).rejects.toThrow();
    expect(Date.now() - t0).toBeLessThan(2000);
  });
});

describe('/api/places lookup: keeps the answer, limits the asking', () => {
  const store = () => { const m = new Map<string, string>(); return { m, get: async (k: string) => m.get(k) ?? null, put: async (k: string, v: string) => { m.set(k, v); } }; };
  it('asks the servers once, then answers from the store', async () => {
    const s = store(); let calls = 0;
    const fetcher = (() => { calls++; return reply(answer(4)); }) as unknown as typeof fetch;
    const q = new URLSearchParams('lat=48.8867&lon=2.3431&r=120');
    const a = await lookup(q, 'ip-a', s, fetcher), b = await lookup(q, 'ip-b', s, fetcher);
    expect(a.status).toBe(200); expect((a.body as { cache: string }).cache).toBe('miss');
    expect(b.status).toBe(200); expect((b.body as { cache: string }).cache).toBe('hit'); expect(b.headers['x-cache']).toBe('hit');
    expect(calls).toBeLessThanOrEqual(6); // one round of the servers, not two
    expect((b.body as { elements: unknown[] }).elements).toHaveLength(4);
  });
  it('a bad request is refused before any server is asked', async () => {
    let calls = 0;
    const r = await lookup(new URLSearchParams('lat=0&lon=0&r=9999'), 'ip', store(), (() => { calls++; return reply({}); }) as unknown as typeof fetch);
    expect(r.status).toBe(400); expect(calls).toBe(0);
  });
  it('limits new places per address, but not cache hits', async () => {
    const now = 1_000_000;
    for (let i = 0; i < 20; i++) expect(limited('same', now + i)).toBe(false);
    expect(limited('same', now + 21)).toBe(true);
    expect(limited('other', now + 21)).toBe(false);
  });
  it('answers 504 with a hint about ready places when no server answers', async () => {
    const r = await lookup(new URLSearchParams('lat=10&lon=10&r=120'), 'ip-z', store(), (() => reply({}, 500)) as unknown as typeof fetch);
    expect(r.status).toBe(504); expect((r.body as { readyPlaces: boolean }).readyPlaces).toBe(true);
  });
});

describe('ready places', () => {
  const index: ReadyIndexEntry[] = [
    { slug: 'a', name: 'A', lat: 48.8867, lon: 2.3431, radius: 120, hill_m: 39, buildings: 80, bytes: 1, blurb: '' },
    { slug: 'b', name: 'B', lat: 48.8967, lon: 2.3431, radius: 120, hill_m: 0, buildings: 80, bytes: 1, blurb: '' },
  ];
  it('a pin within 300 m snaps to the nearest ready place, a pin further away does not', () => {
    expect(nearestReady(index, 48.8869, 2.3433)?.slug).toBe('a');
    expect(nearestReady(index, 48.8867 + 0.002, 2.3431)?.slug).toBe('a'); // 222 m
    expect(nearestReady(index, 48.8867 + 0.0035, 2.3431)).toBeNull(); // 389 m
  });
});

describe('the lane summary says which footprint became which obstacle', () => {
  // a row of blocks along x: a flat run, a 0.6 m step up, then a 2 m wall, in shrunk metres at k = 1 (real heights 6, 6, 6.6, 8)
  const lat0 = 48.8867, lon0 = 2.3431, mLon = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const block = (x0: number, x1: number, h: number) => ({
    type: 'way' as const, tags: { building: 'yes', height: String(h) },
    geometry: [[x0, -3], [x1, -3], [x1, 3], [x0, 3]].map(([x, z]) => ({ lat: lat0 - z / 111320, lon: lon0 + x / mLon })),
  });
  const row: OverpassAnswer = { elements: [block(-20, -8, 6), block(-8, 4, 6), block(4, 12, 6.6), block(12, 22, 8)] };
  it('finds a lane over the row and names the roles of the footprints it runs over', () => {
    const lane = laneForPlace(row, lat0, lon0, null, { ladder: [1] });
    expect(lane).not.toBeNull();
    expect(lane!.cleared).toBe(true);
    expect(lane!.lengthM).toBeGreaterThan(10);
    expect(lane!.roles.length).toBeGreaterThan(1);
    expect(new Set(lane!.roles.map((r) => r.role)).size).toBeGreaterThan(0);
    for (const r of lane!.roles) expect(r.footprint).toBeLessThan(buildingsFrom(row, lat0, lon0).length);
    expect(Math.hypot(lane!.line[2] - lane!.line[0], lane!.line[3] - lane!.line[1])).toBeGreaterThan(10);
  });
  it('footprint numbers count the unfiltered list, so a tiny shed in front does not shift them', () => {
    const shed = block(-30, -29.7, 3); // under 2 square metres (twice the area is under 4): dropped before the lane is cut
    const withShed: OverpassAnswer = { elements: [shed, ...row.elements] };
    const lane = laneForPlace(withShed, lat0, lon0, null, { ladder: [1] });
    expect(lane!.cleared).toBe(true);
    const all = buildingsFrom(withShed, lat0, lon0);
    expect(all.length).toBe(5);
    for (const r of lane!.roles) expect(r.footprint).toBeGreaterThanOrEqual(1); // never the shed (index 0)
    const mids = lane!.roles.map((r) => all[r.footprint].ring.reduce((t, p) => t + p[0], 0) / all[r.footprint].ring.length);
    expect(Math.max(...mids) - Math.min(...mids)).toBeGreaterThan(5); // real buildings along the run
  });
  it('no buildings, no lane', () => {
    expect(laneForPlace({ elements: [] }, lat0, lon0, null)).toBeNull();
  });
});
