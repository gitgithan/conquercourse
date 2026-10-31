// CC-108: challenge courses. Physics first (the server replay is the judge), then the rules: register, dedupe, promote, expire, shape.
// Runs on a real SQLite (node:sqlite) with the real migrations, so the SQL is tested too.
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { courseHash, encodeLog, recordPlan, verifyLog, type InputLog } from '../src/sim/replay';
import { MAX_CLEAR_TICKS, logTicks } from '../src/sim/run-checks';
import { madeCourse, packCourse } from '../src/share/made-course';
import { CREATIONS_PER_PLAYER_PER_DAY, TTL_SECONDS, canonicalCourse, challengeKey, challengeOn, cidOf, courseContentHash, isChallengeKey, isLive, promotes } from '../src/share/challenge-course';
import { createShare, type ShareEnv, type ShareRow, type ShareStore } from '../src/share/server';
import { onRequestGet, onRequestPost } from '../functions/api/challenge-course';
import { onRequestPost as clearPost } from '../functions/api/course-clear';
import { onRequestGet as boardGet } from '../functions/api/leaderboard';
import { loadDemo as load } from './helpers/course';
import { assets, localD1 } from './helpers-d1';

const base = load('training.course.json');
const tweak = (name: string, c: CourseData = base): CourseData => ({ ...c, name }) as CourseData;
const logOf = (c: CourseData): InputLog => recordPlan(c, c.plan!, MAX_CLEAR_TICKS).recorder.snapshot();
const noAssets = { fetch: async () => new Response('no', { status: 404 }) }; // a challenge course is never read from /assets

let ipN = 0; // each call is a new address unless a test says otherwise: the per-address slow-down is not what these tests are about
async function register(db: unknown, c: CourseData, o: { session?: string; ip?: string; keys?: string; log?: InputLog; made?: string } = {}) {
  const log = o.log ?? logOf(c);
  const keys = o.keys ?? await encodeLog(log);
  const made = o.made ?? await packCourse(madeCourse(c)!);
  const res = await onRequestPost({ request: new Request('https://x/api/challenge-course', { method: 'POST', headers: { 'cf-connecting-ip': o.ip ?? `reg-ip-${ipN++}` }, body: JSON.stringify({ session: o.session ?? 'author-session-1', runId: `run-${Math.random().toString(36).slice(2)}-aa`, made, keys, claimedTicks: logTicks(log) }) }), env: { DB: db } as never });
  return { status: res.status, body: await res.json() as Record<string, unknown> };
}
const waited = (log: InputLog, k: number): InputLog => (log[0][0] === 0 ? [[0, log[0][1] + k] as [number, number], ...log.slice(1)] : [[0, k] as [number, number], ...log]); // the same run a few ticks later: a different set of keys
async function clearOn(db: unknown, id: string, c: CourseData, session: string, ip: string, publish = false, wait = 0) {
  const log = wait ? waited(logOf(c), wait) : logOf(c);
  const body = { session, runId: `run-${Math.random().toString(36).slice(2)}-bb`, courseKey: challengeKey(id), hash: courseHash(madeCourse(c)!), keys: await encodeLog(log), claimedTicks: logTicks(log), nick: 'Ace', publish };
  const res = await clearPost({ request: new Request('https://x/api/course-clear', { method: 'POST', headers: { 'cf-connecting-ip': ip }, body: JSON.stringify(body) }), env: { DB: db, ASSETS: noAssets } as never });
  return { status: res.status, body: await res.json() as Record<string, unknown> };
}
const list = async (db: unknown) => (await (await onRequestGet({ request: new Request('https://x/api/challenge-course?list=1'), env: { DB: db } as never })).json() as { courses: { id: string }[] }).courses;
const rows = (sql: { prepare(q: string): { all(...v: unknown[]): unknown[] } }, q: string): Record<string, unknown>[] => sql.prepare(q).all() as Record<string, unknown>[];

describe('the server replay is the judge (physics first)', () => {
  it('a registered course keeps the time the simulator gives, not a time the page said', async () => {
    const { db } = localD1(), c = tweak('Training, my version');
    const log = logOf(c), local = verifyLog(madeCourse(c)!, log, MAX_CLEAR_TICKS);
    expect(local.cleared).toBe(true);
    const r = await register(db, c);
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.ticks).toBe(local.ticks);
  });
  it('keys that do not clear the course register nothing', async () => {
    const { db, sql } = localD1(), c = tweak('Never cleared');
    const half = logOf(c).slice(0, 3); // a few presses, then the keys end: the runner does not reach the finish
    const r = await register(db, c, { log: half });
    expect([422], JSON.stringify(r)).toContain(r.status);
    expect(rows(sql as never, 'SELECT * FROM challenge_courses')).toHaveLength(0);
  });
  it('keys played on a harder course do not register the easier one', async () => {
    const { db, sql } = localD1(), hard = { ...base, name: 'Wider', finishX: base.finishX + 200 } as CourseData;
    const r = await register(db, hard, { log: logOf(base) }); // the keys of the training run stop short of this finish
    expect(r.status).toBe(422);
    expect(rows(sql as never, 'SELECT * FROM challenge_courses')).toHaveLength(0);
  });
});

describe('registering', () => {
  it('stores one row with an expiry, the author code (never the session) and a first clear on its board', async () => {
    const { db, sql } = localD1();
    const r = await register(db, tweak('Mine'), { session: 'secret-session-value' });
    expect(r.status).toBe(201);
    const row = rows(sql as never, 'SELECT * FROM challenge_courses')[0];
    expect(row.id).toBe(r.body.id); expect(row.promoted_at).toBeNull(); expect(row.expires_at).not.toBeNull();
    expect(JSON.stringify(row)).not.toContain('secret-session-value');
    const clears = rows(sql as never, "SELECT * FROM course_clears WHERE course_key LIKE 'challenge/%'");
    expect(clears).toHaveLength(1); expect(clears[0]).toMatchObject({ verified: 1, published: 0, course_hash: r.body.boardHash });
  });
  it('the same course sent again is one entry (dedupe by content hash)', async () => {
    const { db, sql } = localD1(), c = tweak('Same twice');
    const a = await register(db, c), b = await register(db, c, { ip: 'ip-b' });
    expect(b.body.id).toBe(a.body.id); expect(b.body.duplicate).toBe(true);
    expect(rows(sql as never, 'SELECT * FROM challenge_courses')).toHaveLength(1);
  });
  it('a different course is a different entry', async () => {
    const { db, sql } = localD1();
    await register(db, tweak('One')); await register(db, tweak('Two'), { ip: 'ip-b' });
    expect(rows(sql as never, 'SELECT * FROM challenge_courses')).toHaveLength(2);
  });
  it('the plans stored with a course and its looks do not make a second entry', async () => {
    const a = canonicalCourse(tweak('Plain'))!, b = canonicalCourse({ ...tweak('Plain'), plan: [{ x: 1 }] } as unknown as CourseData);
    // a course carrying a stored plan is not a made course (plans stay home), so the page never sends one; the canonical form agrees either way
    expect(b === null || (await courseContentHash(b.json)) === (await courseContentHash(a.json))).toBe(true);
  });
  it('the per-player creation cap refuses the next one with its own reason', async () => {
    const { db } = localD1();
    for (let i = 0; i < CREATIONS_PER_PLAYER_PER_DAY; i++) expect((await register(db, tweak(`Cap ${i}`), { session: 'capped-session-1', ip: `ip-${i}` })).status).toBe(201);
    const next = await register(db, tweak('Cap next'), { session: 'capped-session-1', ip: 'ip-next' });
    expect(next.status).toBe(429); expect(next.body.reason).toBe('creation-cap');
    expect((await register(db, tweak('Cap other player'), { session: 'someone-else-1', ip: 'ip-other' })).status).toBe(201); // another player is not capped
  });
});

describe('shape is checked on the server, never trusted', () => {
  const bad = async (mutate: (c: Record<string, unknown>) => void) => {
    const { db, sql } = localD1(), c = JSON.parse(JSON.stringify(madeCourse(tweak('Shape'))!)) as Record<string, unknown>;
    mutate(c);
    const r = await register(db, tweak('Shape'), { made: await packCourse(c as unknown as CourseData) });
    expect(r.status, JSON.stringify(r.body)).toBe(422); expect(r.body.reason).toBe('bad-course');
    expect(rows(sql as never, 'SELECT * FROM challenge_courses')).toHaveLength(0);
  };
  it('refuses markup in text', () => bad((c) => { c.name = '<script>alert(1)</script>'; }));
  it('refuses a hostile key', () => bad((c) => { Object.defineProperty(c, 'constructor', { value: { x: 1 }, enumerable: true }); }));
  it('refuses too many platforms', () => bad((c) => { const t = c.terrain as { platforms: unknown[] }; t.platforms = Array.from({ length: 61 }, (_, i) => ({ x0: i, x1: i + 1, top: 0 })); }));
  it('refuses numbers out of range', () => bad((c) => { c.finishX = 1e9; }));
  it('refuses something that is not a course', async () => {
    const { db } = localD1();
    expect((await register(db, tweak('x'), { made: await packCourse({ hello: 1 } as unknown as CourseData) })).status).toBe(422);
    expect((await register(db, tweak('x'), { made: 'zzz' })).status).toBe(422);
  });
  it('refuses a body that is too big or not JSON', async () => {
    const { db } = localD1();
    const big = await onRequestPost({ request: new Request('https://x/', { method: 'POST', body: 'x'.repeat(60_000) }), env: { DB: db } as never });
    expect(big.status).toBe(413);
    const junk = await onRequestPost({ request: new Request('https://x/', { method: 'POST', body: '{nope' }), env: { DB: db } as never });
    expect(junk.status).toBe(400);
  });
});

describe('promotion by play', () => {
  it('the rule: another player promotes, the author never does', () => {
    expect(promotes('aaaa', 'bbbb')).toBe(true);
    expect(promotes('aaaa', 'aaaa')).toBe(false);
    expect(promotes('aaaa', '')).toBe(false);
  });
  it('a new course is not listed; the author clearing it again does not list it; another player clearing it does', async () => {
    const { db, sql } = localD1(), c = tweak('To promote');
    const r = await register(db, c), id = r.body.id as string;
    expect(await list(db)).toEqual([]);
    expect((await clearOn(db, id, c, 'author-session-1', 'ip-a')).status).toBe(200);
    expect(await list(db)).toEqual([]);
    expect(rows(sql as never, 'SELECT promoted_at, expires_at FROM challenge_courses')[0].promoted_at).toBeNull();
    const other = await clearOn(db, id, c, 'other-player-session', 'ip-o', false, 7);
    expect(other.status, JSON.stringify(other.body)).toBe(200); expect(other.body.verified).toBe(true);
    const listed = await list(db);
    expect(listed.map((x) => x.id)).toEqual([id]);
    expect(rows(sql as never, 'SELECT promoted_at, expires_at FROM challenge_courses')[0]).toMatchObject({ expires_at: null });
  });
  it('another player registering the same course with a verified clear also promotes it, with no second entry', async () => {
    const { db, sql } = localD1(), c = tweak('Twice built');
    const a = await register(db, c), b = await register(db, c, { session: 'second-player-1', ip: 'ip-b' });
    expect(b.body.id).toBe(a.body.id);
    expect((await list(db)).map((x) => x.id)).toEqual([a.body.id]);
    expect(rows(sql as never, 'SELECT * FROM challenge_courses')).toHaveLength(1);
  });
  it('the author\'s own keys sent by another browser do not promote (a copy is not a play)', async () => {
    const { db } = localD1(), c = tweak('Copied keys'), id = (await register(db, c)).body.id as string;
    expect((await clearOn(db, id, c, 'copycat-session-1', 'ip-c')).body.duplicate).toBe(true);
    expect(await list(db)).toEqual([]);
  });
  it('a run that does not clear never promotes', async () => {
    const { db } = localD1(), c = tweak('No promotion'), id = (await register(db, c)).body.id as string;
    const body = { session: 'other-player-session', runId: 'run-notclear-1', courseKey: challengeKey(id), hash: courseHash(madeCourse(c)!), keys: await encodeLog(logOf(c).slice(0, 3)) };
    const res = await clearPost({ request: new Request('https://x/api/course-clear', { method: 'POST', headers: { 'cf-connecting-ip': 'ip-n' }, body: JSON.stringify(body) }), env: { DB: db, ASSETS: noAssets } as never });
    expect(res.status).toBe(422);
    expect(await list(db)).toEqual([]);
  });
  it('the per-course board is the clears of that course only, comparable within it', async () => {
    const { db } = localD1(), c = tweak('Board'), r = await register(db, c), id = r.body.id as string;
    const pub = await clearOn(db, id, c, 'other-player-session', 'ip-o', true, 7);
    expect(pub.body).toMatchObject({ published: true, rank: 1 });
    const hash = courseHash(madeCourse(c)!);
    const top = (await (await boardGet({ request: new Request(`https://x/api/leaderboard?course=${challengeKey(id)}&hash=${hash}&window=all`), env: { DB: db } as never })).json() as { top: { nick: string }[] }).top;
    expect(top.map((t) => t.nick)).toEqual(['Ace']);
    const elsewhere = (await (await boardGet({ request: new Request(`https://x/api/leaderboard?course=demo/training&hash=${hash}&window=all`), env: { DB: db } as never })).json() as { top: unknown[] }).top;
    expect(elsewhere).toEqual([]);
  });
});

describe('the server reads the course from storage', () => {
  it('a clear on a challenge course works with no course file anywhere, and a wrong hash is "course changed"', async () => {
    const { db } = localD1(), c = tweak('From storage'), id = (await register(db, c)).body.id as string;
    expect((await clearOn(db, id, c, 'player-two-session', 'ip-2')).status).toBe(200);
    const log = logOf(c);
    const res = await clearPost({ request: new Request('https://x/api/course-clear', { method: 'POST', headers: { 'cf-connecting-ip': 'ip-3' }, body: JSON.stringify({ session: 'player-three-sess', runId: 'run-wrong-hash1', courseKey: challengeKey(id), hash: 'abc', keys: await encodeLog(log) }) }), env: { DB: db, ASSETS: assets } as never });
    expect(res.status).toBe(409); expect(await res.json()).toMatchObject({ reason: 'course-changed' });
  });
  it('an id that was never registered is "no-course", never a crash', async () => {
    const { db } = localD1();
    const res = await clearPost({ request: new Request('https://x/api/course-clear', { method: 'POST', headers: { 'cf-connecting-ip': 'ip-4' }, body: JSON.stringify({ session: 'player-four-sess', runId: 'run-nothing-0001', courseKey: 'challenge/abcdefghjk', hash: 'abc', keys: await encodeLog(logOf(base)) }) }), env: { DB: db, ASSETS: noAssets } as never });
    expect(res.status).toBe(404); expect(await res.json()).toMatchObject({ reason: 'no-course' });
  });
  it('the challenge key must have the shape of an id; nothing else gets in through the key', () => {
    expect(isChallengeKey('challenge/abcdefghjk')).toBe(true);
    for (const k of ['challenge/', 'challenge/ABCDEFGHJK', 'challenge/abc', 'challenge/abcdefghjk/x', 'challenge/abcdefghi1', 'demo/training']) expect(isChallengeKey(k), k).toBe(false);
  });
});

describe('expiry', () => {
  it('an unpromoted course expires after the time to live; a promoted one stays', async () => {
    const { db, sql } = localD1(), a = tweak('Will expire'), b = tweak('Will stay');
    const ida = (await register(db, a)).body.id as string, idb = (await register(db, b, { ip: 'ip-b' })).body.id as string;
    await clearOn(db, idb, b, 'other-player-session', 'ip-o', false, 7); // promotes b
    const year = Math.floor(Date.now() / 1000) + 365 * 86400;
    (sql as unknown as { exec(q: string): void }).exec(`UPDATE challenge_courses SET expires_at = ${Math.floor(Date.now() / 1000) - 5} WHERE promoted_at IS NULL`);
    const get = async (id: string) => (await onRequestGet({ request: new Request(`https://x/api/challenge-course?id=${id}`), env: { DB: db } as never })).status;
    expect(await get(ida)).toBe(410);
    expect(await get(idb)).toBe(200);
    expect((await clearOn(db, ida, a, 'late-player-session', 'ip-l')).status).toBe(410);
    await list(db); // listing (and every registration) removes the expired rows and their clears
    expect(rows(sql as never, 'SELECT id FROM challenge_courses').map((r) => r.id)).toEqual([idb]);
    expect(rows(sql as never, `SELECT * FROM course_clears WHERE course_key = '${challengeKey(ida)}'`)).toHaveLength(0);
    expect(year).toBeGreaterThan(0);
  });
  it('liveness: promoted always; unpromoted only before its expiry; the time to live is about two weeks', () => {
    expect(isLive({ promoted_at: 5, expires_at: null }, 1e12)).toBe(true);
    expect(isLive({ promoted_at: null, expires_at: 100 }, 99)).toBe(true);
    expect(isLive({ promoted_at: null, expires_at: 100 }, 100)).toBe(false);
    expect(TTL_SECONDS).toBe(14 * 86400);
  });
});

describe('a share link can belong to a challenge course', () => {
  const lacheShare = (c: CourseData, challengeHash: ShareEnv['challengeHash']): { env: ShareEnv; rows: Map<string, ShareRow> } => {
    const rows = new Map<string, ShareRow>();
    const store: ShareStore = { byContentHash: async (h) => [...rows.values()].find((r) => r.content_hash === h)?.id ?? null, insert: async (r) => { rows.set(r.id, { ...r }); return true; }, get: async (id) => rows.get(id) ?? null, countSince: async () => 0 };
    return { rows, env: { store, hits: new Map(), now: () => 1_800_000_000_000, address: '9.9.9.9', randomBytes: (k) => crypto.getRandomValues(new Uint8Array(k)), loadCourse: async () => null, challengeHash } };
  };
  it('keeps cid only when the server has that very course', async () => {
    const { db } = localD1(), c = tweak('Linked'), reg = await register(db, c), id = reg.body.id as string;
    const { makeChallengeParam } = await import('../src/sim/replay');
    const made = await packCourse(madeCourse(c)!), played = madeCourse(c)!;
    const param = await makeChallengeParam(played, logOf(c), 'ABC', 'done');
    const good = lacheShare(c, async (i) => (i === id ? String(reg.body.boardHash) : null));
    const ok = await createShare(good.env, JSON.stringify({ param, query: `cid=${id}`, made }));
    expect(ok.status, JSON.stringify(ok.body)).toBe(201);
    expect([...good.rows.values()][0].query).toBe(`cid=${id}`);
    const fake = await createShare(lacheShare(c, async () => null).env, JSON.stringify({ param, query: 'cid=abcdefghjk', made }));
    expect(fake.status).toBe(422);
    const noMade = await createShare(good.env, JSON.stringify({ param, query: `cid=${id}` }));
    expect(noMade.status).toBeGreaterThanOrEqual(400);
  });
});

describe('the feature switch and the address', () => {
  it('?challenge=0 hides it; anything else shows it; the build constant wins', () => {
    expect(challengeOn(new URLSearchParams(''))).toBe(true);
    expect(challengeOn(new URLSearchParams('challenge=0'))).toBe(false);
    expect(challengeOn(new URLSearchParams('challenge=1'))).toBe(true);
    expect(challengeOn(new URLSearchParams(''), false)).toBe(false);
  });
  it('cid is read only when it has the shape of an id', () => {
    expect(cidOf(new URLSearchParams('cid=abcdefghjk'))).toBe('abcdefghjk');
    expect(cidOf(new URLSearchParams('cid=../etc'))).toBeNull();
    expect(cidOf(new URLSearchParams(''))).toBeNull();
  });
});

describe('listed courses are untouched', () => {
  it('a challenge course cannot be asked for through a listed key, and a listed key still needs its own course', async () => {
    const { db } = localD1();
    const res = await clearPost({ request: new Request('https://x/api/course-clear', { method: 'POST', headers: { 'cf-connecting-ip': 'ip-5' }, body: JSON.stringify({ session: 'player-five-sess1', runId: 'run-listed-0001', courseKey: 'demo/park-run', hash: 'abc', keys: await encodeLog(logOf(base)), publish: true }) }), env: { DB: db, ASSETS: assets } as never });
    expect(res.status).toBe(422); expect(await res.json()).toMatchObject({ reason: 'not-listed' });
  });
});
