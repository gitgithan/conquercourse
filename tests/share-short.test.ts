// Short share links (CC-219): the server code with an in-memory store, the D1 store on a real SQLite database with the real migration, and the client side with a fake server.
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { d1Store } from '../functions/api/share';
import { onRequestGet } from '../functions/api/share/[id]';
import { expandShortSearch, isOldLongLink, makeLink, makeLinkInfo, openChallenge } from '../src/share/challenge';
import { expandedAddress } from './helpers/share-address';
import { createShare, ID_RE, MAX_SHARE_BODY, newId, readShare, SHARES_PER_ADDRESS, SHARES_PER_HOUR, type ShareEnv, type ShareRow, type ShareStore } from '../src/share/server';
import { makeChallengeParam, recordPlan, type InputLog } from '../src/sim/replay';
import { localD1 } from './helpers-d1';
import { loadDemo as load } from './helpers/course';

const lache = load('lache.course.json');
const logOf = (c: CourseData): InputLog => recordPlan(c, c.plan!, 120 * 120).recorder.snapshot();
const ORIGIN = 'https://conquercourse.pages.dev';

/** An in-memory stand-in for D1. */
function fakeStore(): ShareStore & { rows: Map<string, ShareRow> } {
  const rows = new Map<string, ShareRow>();
  return {
    rows,
    byContentHash: async (h) => [...rows.values()].find((r) => r.content_hash === h && r.status === 'ok')?.id ?? null,
    insert: async (r) => { if (rows.has(r.id)) return false; rows.set(r.id, { ...r }); return true; },
    get: async (id) => rows.get(id) ?? null,
    countSince: async (t) => [...rows.values()].filter((r) => r.created_at > t).length,
  };
}
function envOf(store: ShareStore = fakeStore(), over: Partial<ShareEnv> = {}): ShareEnv {
  return {
    store, hits: new Map(), now: () => 1_800_000_000_000, address: '1.2.3.4',
    randomBytes: (k) => crypto.getRandomValues(new Uint8Array(k)),
    loadCourse: async (key) => (key === 'demo/lache' ? lache : null),
    ...over,
  };
}
const body = async (o: { c?: CourseData; log?: InputLog; nick?: string; kind?: 'done' | 'fell'; query?: string; made?: string } = {}) => {
  const c = o.c ?? lache;
  return JSON.stringify({ param: await makeChallengeParam(c, o.log ?? logOf(c), o.nick ?? '', o.kind ?? 'done'), query: o.query ?? 'course=/assets/demo/lache.course.json', made: o.made });
};

describe('ids', () => {
  it('are ten characters of the safe alphabet, and spread evenly', () => {
    const ids = Array.from({ length: 20 }, () => newId((k) => crypto.getRandomValues(new Uint8Array(k))));
    for (const id of ids) expect(id).toMatch(ID_RE);
    expect(new Set(ids).size).toBe(20);
  });
  it('skip bytes that would favour some letters', () => {
    expect(newId(() => Uint8Array.from([255, 250, 248, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))).toBe('abcdefghjk');
  });
});

describe('POST /api/share logic', () => {
  it('stores a cleared run and gives it back by its id as the same challenge text', async () => {
    const env = envOf();
    const r = await createShare(env, await body({ nick: 'ABC' }));
    expect(r.status).toBe(201);
    const id = r.body.id as string;
    expect(id).toMatch(ID_RE);
    const got = await readShare(env, id);
    expect(got.status).toBe(200);
    expect(got.body.param).toBe(await makeChallengeParam(lache, logOf(lache), 'ABC'));
    // and that text opens as the same run on the course
    const opened = await openChallenge(lache, got.body.param as string);
    expect(opened.ok).toBe(true);
  });
  it('keeps one row when the same run is shared twice, and says so', async () => {
    const store = fakeStore(), env = envOf(store);
    const a = await createShare(env, await body()), b = await createShare(env, await body());
    expect(b.status).toBe(200);
    expect(b.body).toEqual({ id: a.body.id, duplicate: true });
    expect(store.rows.size).toBe(1);
    await createShare(env, await body({ nick: 'ZZZ' })); // another tag is another link
    expect(store.rows.size).toBe(2);
  });
  it('stores no address, name or time: the row has only the listed columns', async () => {
    const store = fakeStore();
    await createShare(envOf(store), await body());
    expect(Object.keys([...store.rows.values()][0]).sort()).toEqual(['beats_ideal', 'content_hash', 'course_hash', 'course_key', 'course_kind', 'created_at', 'id', 'keys', 'kind', 'look', 'made', 'nick', 'query', 'sim_version', 'status', 'ticks']);
  });
  it('turns away what is too big, damaged, old, for a changed course, for an unknown course or physically impossible', async () => {
    const env = envOf();
    expect((await createShare(env, 'x'.repeat(MAX_SHARE_BODY + 1))).status).toBe(413);
    expect((await createShare(env, 'not json')).status).toBe(400);
    expect((await createShare(env, JSON.stringify({ param: '1.abc..r%%%', query: '' }))).status).toBe(400);
    expect((await createShare(env, JSON.stringify({ param: '9.abc..rAAAA', query: '' }))).body.error).toBe('old version');
    const changed = JSON.parse(await body()); changed.param = changed.param.replace(/^1\.[a-z0-9]+/, '1.zzzz');
    expect((await createShare(env, JSON.stringify(changed))).status).toBe(409);
    expect((await createShare(env, await body({ query: 'course=/assets/demo/nope.course.json' }))).status).toBe(404);
    expect((await createShare(env, await body({ query: 'course=/assets/../secret.json' }))).status).toBe(422);
    expect((await createShare(env, await body({ query: 'generate=7' }))).status).toBe(422);
    const slow = await createShare(env, await body({ log: [[0, 20], [1, 30]] })); // 0.4 s: too short
    expect(slow.status).toBe(422);
    expect(slow.body.code).toBe('too-short');
    const fast = await createShare(env, await body({ log: [[0, 100], [1, 100]] })); // finishes a long course in under 2 s
    expect(fast.body.code).toBe('too-fast');
  });
  it('keeps a try that fell, with no finish check', async () => {
    const env = envOf();
    const log: InputLog = [[0, 30], [1, 60], [0, 40]];
    const r = await createShare(env, await body({ log, kind: 'fell' }));
    if (r.status !== 201) throw new Error(JSON.stringify(r.body));
    const got = await readShare(env, r.body.id as string);
    expect((got.body.param as string).startsWith('1f.')).toBe(true);
    expect(got.body.kind).toBe('fell');
  });
  it('slows one address and the whole site', async () => {
    const env = envOf();
    for (let i = 0; i < SHARES_PER_ADDRESS; i++) expect((await createShare(env, await body({ nick: `A${i % 10}${String.fromCharCode(65 + (i % 26))}` }))).status).toBeLessThan(300);
    expect((await createShare(env, await body())).status).toBe(429);
    const store = fakeStore();
    for (let i = 0; i < SHARES_PER_HOUR; i++) store.rows.set(`x${i}`, { created_at: 1_800_000_000 - 10 } as ShareRow);
    expect((await createShare(envOf(store), await body())).status).toBe(429);
  });
  it('carries a made course past the 2000-character limit of a link', async () => {
    const { madeCourse, packCourse, MAX_MADE_CHARS } = await import('../src/share/made-course');
    const big = madeCourse(lache)!;
    const last = big.terrain.platforms[big.terrain.platforms.length - 1];
    let seed = 5; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; // far beyond the finish: the run still ends where it did
    for (let i = 0; i < 55; i++) { const x0 = last.x1 + 1 + i * 3; big.terrain.platforms.push({ ...last, x0: +(x0 + rnd()).toFixed(12), x1: +(x0 + 1 + rnd()).toFixed(12), top: +(rnd() * 3).toFixed(12) }); }
    const made = await packCourse(big);
    expect(made.length).toBeGreaterThan(MAX_MADE_CHARS); // too big for a long link
    const env = envOf();
    const r = await createShare(env, JSON.stringify({ param: await makeChallengeParam(big, logOf(lache)), query: '', made }));
    expect(r.status).toBe(201);
    expect((await readShare(env, r.body.id as string)).body.made).toBe(made);
    const huge = await createShare(env, JSON.stringify({ param: 'x', query: '', made: 'd' + 'A'.repeat(20_001) }));
    expect(huge.status).toBe(413);
  });
  it('a hidden share answers 404', async () => {
    const store = fakeStore(), env = envOf(store);
    const id = (await createShare(env, await body())).body.id as string;
    store.rows.get(id)!.status = 'hidden';
    expect((await readShare(env, id)).status).toBe(404);
    expect((await readShare(env, 'short')).status).toBe(404);
  });
});

describe('the D1 store on the real migration', () => {
  it('inserts, finds, dedupes, counts and refuses a taken id', async () => {
    const { db } = localD1();
    const store = d1Store(db as never), env = envOf(store);
    const a = await createShare(env, await body({ nick: 'AAA' }));
    expect(a.status).toBe(201);
    expect((await createShare(env, await body({ nick: 'AAA' }))).body.duplicate).toBe(true);
    const row = await store.get(a.body.id as string);
    expect(row?.course_key).toBe('demo/lache');
    expect(row?.sim_version).toBe(1);
    expect(await store.countSince(0)).toBe(1);
    expect(await store.insert({ ...row!, content_hash: 'other' })).toBe(false); // same id
    const res = await onRequestGet({ params: { id: a.body.id as string }, env: { DB: db, ASSETS: { fetch: async () => new Response('no') } } as never });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('max-age');
  });
  it('answers 503 when the table is missing, so the game says links are not working', async () => {
    const { db } = localD1('0005');
    const res = await onRequestGet({ params: { id: 'abcdefghjk' }, env: { DB: db, ASSETS: { fetch: async () => new Response('no') } } as never });
    expect(res.status).toBe(503);
  });
});

describe('the client', () => {
  const server = () => {
    const env = envOf(), calls: string[] = [];
    const f = (async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (url === '/api/share') { const r = await createShare(env, String(init!.body)); return new Response(JSON.stringify(r.body), { status: r.status }); }
      const r = await readShare(env, url.split('/').pop()!);
      return new Response(JSON.stringify(r.body), { status: r.status });
    }) as unknown as typeof fetch;
    return { f, calls };
  };
  const search = '?course=/assets/demo/lache.course.json';
  const kept = (p: string, k: string): string | null => new URLSearchParams(p).get(k);
  it('makes a short link when the server answers, and it expands back to an address the page reads', async () => {
    const { f } = server();
    const url = await makeLink(ORIGIN, search, lache, logOf(lache), 'KIM', 'b', 'done', f);
    expect(url).toMatch(/^https:\/\/conquercourse\.pages\.dev\/\?c=[a-z2-9]{10}$/);
    const long = await expandShortSearch(new URL(url!).search, f);
    const want = await expandedAddress(ORIGIN, search, lache, logOf(lache), 'KIM', 'b');
    expect(kept(long!, 'challenge')).toBe(new URL(want!).searchParams.get('challenge'));
    expect(kept(long!, 'course')).toBe('/assets/demo/lache.course.json');
    expect(kept(long!, 'rk')).toBe('b');
    expect(kept(long!, 'c')).toMatch(ID_RE); // the short id stays: it marks the challenge as one the server vouches for
  });
  it('says why there is no link: server down, switched off, or bad answer is "down"; never a long link', async () => {
    const down = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    const off = (async () => new Response('{}', { status: 503 })) as unknown as typeof fetch;
    const html = (async () => new Response('<html>', { status: 200 })) as unknown as typeof fetch;
    for (const f of [down, off, html]) {
      const r = await makeLinkInfo(ORIGIN, search, lache, logOf(lache), '', 'a', 'done', f);
      expect(r).toEqual({ url: null, wait: null, down: true });
    }
  });
  it('a pause is reported with its seconds, not as down', async () => {
    const slow = (async () => new Response(JSON.stringify({ reason: 'slow_down', retryAfterSeconds: 38 }), { status: 429, headers: { 'retry-after': '38' } })) as unknown as typeof fetch;
    const r = await makeLinkInfo(ORIGIN, search, lache, logOf(lache), '', 'a', 'done', slow);
    expect(r.url).toBeNull(); expect(r.wait).toBe(38); expect(r.down).toBeFalsy();
  });
  it('the build has no long-link switch: ?short=0 changes nothing', async () => {
    const { f, calls } = server();
    const url = await makeLink(ORIGIN, `${search}&short=0`, lache, logOf(lache), '', 'a', 'done', f);
    expect(url).toMatch(/\?c=/);
    expect(calls).toEqual(['POST /api/share']);
  });
  it('a generated course, a coaster course and a made course all get a short link that opens the same run', async () => {
    const { generateCourse } = await import('../src/slice/generator');
    const { coasterCourse, parseTrack } = await import('../src/slice/coaster');
    const { madeCourse } = await import('../src/share/made-course');
    const { verifyLog } = await import('../src/sim/replay');
    const cases: [string, CourseData][] = [['?generate=7', generateCourse(7)], ['?coaster=0,9;7,5;14,1;22,0.6;34,3.6;46,0.6;56,0.2', coasterCourse('My coaster', parseTrack('0,9;7,5;14,1;22,0.6;34,3.6;46,0.6;56,0.2')!, 1.5)]];
    for (const [q, course] of cases) {
      const log: InputLog = course.plan ? logOf(course) : [[1, 741]]; // a coaster has no stored plan: holding the push key clears it
      const { f } = server();
      const url = await makeLink(ORIGIN, q, course, log, 'ZED', 'a', 'done', f);
      expect(url, q).toMatch(/\?c=[a-z2-9]{10}$/);
      const long = (await expandShortSearch(new URL(url!).search, f))!;
      expect(kept(long, 'generate')).toBeNull(); expect(kept(long, 'coaster')).toBeNull(); // the saved course is read from `made`, not rebuilt from the words
      const { unpackCourse, SHARE_MAX_MADE_CHARS } = await import('../src/share/made-course');
      const played = (await unpackCourse(kept(long, 'made')!, SHARE_MAX_MADE_CHARS))!;
      expect(played).toEqual(madeCourse(course));
      expect(verifyLog(played, log).cleared).toBe(true);
      expect((await openChallenge(played, kept(long, 'challenge')!)).ok).toBe(true);
    }
  });
  it('a course from the editor or the Park (a file not in the list) is carried too', async () => {
    const { f } = server();
    const url = await makeLink(ORIGIN, '?course=/assets/experiments/park/mine.course.json', lache, logOf(lache), '', 'a', 'done', f);
    expect(url).toMatch(/\?c=/);
  });
  it('an old long address is recognised and not opened; a short one is not an old link', () => {
    expect(isOldLongLink(new URLSearchParams('?challenge=1.abc.def.ghi'))).toBe(true);
    expect(isOldLongLink(new URLSearchParams('?made=dxx&challenge=1f.abc'))).toBe(true);
    expect(isOldLongLink(new URLSearchParams('?c=abcdefghjk&challenge=1.abc'))).toBe(false);
    expect(isOldLongLink(new URLSearchParams('?challenge=0'))).toBe(false);
    expect(isOldLongLink(new URLSearchParams('?challenge=broken'))).toBe(false);
    expect(isOldLongLink(new URLSearchParams('?course=/assets/demo/lache.course.json'))).toBe(false);
  });
  it('an address with no short id is left alone and makes no server call', async () => {
    const { f, calls } = server();
    expect(await expandShortSearch('?challenge=1.abc..rAAAA', f)).toBeNull();
    expect(await expandShortSearch('?course=/assets/demo/lache.course.json', f)).toBeNull();
    expect(calls).toEqual([]);
  });
  it('a short id that is unknown or malformed is shown as a damaged link', async () => {
    const { f } = server();
    for (const id of ['abcdefghjk', 'x', '../etc']) expect(new URLSearchParams((await expandShortSearch(`?c=${id}`, f))!).get('challenge')).toBe('broken');
  });
  it('the link is the same short length whatever the run is', async () => {
    const { f } = server();
    const url = await makeLink(ORIGIN, search, lache, logOf(lache), '', 'a', 'done', f);
    expect(url!.length).toBe(`${ORIGIN}/?c=`.length + 10);
  });
});
