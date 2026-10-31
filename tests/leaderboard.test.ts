// CC-108: the leaderboard, the player's tag, the personal best, and the D1 upload ledger (race-safe daily slots).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { courseHash, encodeLog, recordPlan } from '../src/sim/replay';
import { logTicks } from '../src/sim/run-checks';
import { onRequestPost as clearPost } from '../functions/api/course-clear';
import { onRequestGet as boardGet } from '../functions/api/leaderboard';
import { onRequestGet as runGet } from '../functions/api/leaderboard-run';
import { d1Ledger } from '../src/slice/d1-ledger';
import { bestShown, boardLines, readBest, rememberBest } from '../src/ui/leaderboard';
import { assets, localD1 } from './helpers-d1';

const course = JSON.parse(readFileSync('public/assets/demo/training.course.json', 'utf8')) as CourseData;
const hash = courseHash(course);
const log = recordPlan(course, course.plan!, 120 * 120).recorder.snapshot();
const send = async (db: unknown, n: number, nick?: string, publish = true) => {
  const body = { session: 'abcdef12-3456', runId: `run-0000000${n}`, courseKey: 'demo/training', hash, keys: await encodeLog(log), claimedTicks: logTicks(log), nick, publish };
  return clearPost({ request: new Request('https://x/api/course-clear', { method: 'POST', headers: { 'cf-connecting-ip': `ip${n}` }, body: JSON.stringify(body) }), env: { DB: db, ASSETS: assets } as never });
};
const board = async (db: unknown, h = hash) => (await boardGet({ request: new Request(`https://x/api/leaderboard?course=demo/training&hash=${h}`), env: { DB: db } as never })).json() as Promise<{ top: { id: number; nick: string; ticks: number }[] }>;

describe('the leaderboard', () => {
  it('shows a verified run with its tag, and keeps the keys so it can be a ghost', async () => {
    const { db, sql } = localD1();
    expect((await send(db, 1, 'Ace_Runner')).status).toBe(200);
    const top = (await board(db)).top;
    expect(top).toHaveLength(1); expect(top[0].nick).toBe('Ace_Runner');
    expect((sql.prepare('SELECT keys FROM course_clears').get() as { keys: string }).keys.length).toBeGreaterThan(10);
  });
  it('a blocked word becomes no tag, and a run kept unverified is not on the board', async () => {
    const { db } = localD1();
    await send(db, 2, 'fuk');
    expect((await board(db)).top[0].nick).toBe('');
    const cut = localD1();
    const body = { session: 'abcdef12-3456', runId: 'run-00000009', courseKey: 'demo/training', hash, keys: await encodeLog(log), claimedTicks: logTicks(log) };
    await clearPost({ request: new Request('https://x/api/course-clear', { method: 'POST', body: JSON.stringify(body) }), env: { DB: cut.db, ASSETS: assets, REPLAY: 'off' } as never });
    expect((await board(cut.db)).top).toEqual([]);
  });
  it('only the course as it is today counts, and a bad course is refused', async () => {
    const { db } = localD1();
    await send(db, 3, 'abc');
    expect((await board(db, 'zzzz')).top).toEqual([]);
    const bad = await boardGet({ request: new Request('https://x/api/leaderboard?course=../etc&hash=a'), env: { DB: db } as never });
    expect(bad.status).toBe(400);
  });
  it('before migration 0007 the board is empty, not an error', async () => {
    const { db } = localD1('0006');
    expect((await board(db)).top).toEqual([]);
  });
  it('lines read like a scoreboard', () => expect(boardLines([{ nick: 'ACE', ticks: 3240 }, { nick: '', ticks: 3600 }])).toEqual(['1  ACE  27.0 s', '2  ···  30.0 s']));
});

describe('publishing (migration 0012)', () => {
  it('a clear that is not published is counted but never reaches the board, and keeps no tag or keys', async () => {
    const { db, sql } = localD1();
    expect((await send(db, 4, 'abc', false)).status).toBe(200);
    expect((await board(db)).top).toEqual([]);
    const row = sql.prepare('SELECT nick, keys, published FROM course_clears').get() as { nick: string; keys: string | null; published: number };
    expect(row).toMatchObject({ nick: '', keys: null, published: 0 });
  });
  it('publishing the same run later puts it on the board with its tag, a rank and an id for View Run', async () => {
    const { db } = localD1();
    await send(db, 5, 'abc', false);
    const r = await (await send(db, 5, 'Ace', true)).json() as { published: boolean; rank: number; players: number };
    expect(r).toMatchObject({ published: true, rank: 1, players: 1 });
    const top = (await board(db)).top;
    expect(top[0]).toMatchObject({ nick: 'Ace' });
    const run = await (await runGet({ request: new Request(`https://x/api/leaderboard-run?id=${top[0].id}`), env: { DB: db } as never })).json() as { keys: string };
    expect(run.keys.length).toBeGreaterThan(10);
  });
  it('an unpublished run cannot be fetched, and a bad id is refused', async () => {
    const { db } = localD1();
    await send(db, 6, 'abc', false);
    expect((await runGet({ request: new Request('https://x/api/leaderboard-run?id=1'), env: { DB: db } as never })).status).toBe(404);
    expect((await runGet({ request: new Request('https://x/api/leaderboard-run?id=x'), env: { DB: db } as never })).status).toBe(400);
  });
  it('the newest published run is the news line', async () => {
    const { db } = localD1();
    expect(await (await boardGet({ request: new Request('https://x/api/leaderboard?recent=1'), env: { DB: db } as never })).json()).toEqual({ run: null });
    await send(db, 7, 'Zed');
    const d = await (await boardGet({ request: new Request('https://x/api/leaderboard?recent=1'), env: { DB: db } as never })).json() as { run: { nick: string; course: string } };
    expect(d.run).toMatchObject({ nick: 'Zed', course: 'demo/training' });
  });
});

describe('the personal best', () => {
  const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };
  it('keeps the faster time per course version', () => {
    const s = mem();
    expect(rememberBest('demo/a', 'h1', 3000, s)).toEqual({ best: 3000, isNew: true });
    expect(rememberBest('demo/a', 'h1', 3500, s)).toEqual({ best: 3000, isNew: false });
    expect(rememberBest('demo/a', 'h1', 2900, s)).toEqual({ best: 2900, isNew: true });
    expect(readBest('demo/a', 'h2', s)).toBeNull();
  });
});

describe('the D1 upload ledger', () => {
  const lim = { perPlayer: 2, perGame: 3 };
  it('stops a player at the player limit and the game at the game limit', async () => {
    const { db } = localD1(); const l = d1Ledger(db as never);
    expect(await l.take('p1', '2026-10-30', lim)).toEqual({ ok: true });
    expect(await l.take('p1', '2026-10-30', lim)).toEqual({ ok: true });
    expect(await l.take('p1', '2026-10-30', lim)).toEqual({ ok: false, limit: 'player' });
    expect(await l.take('p2', '2026-10-30', lim)).toEqual({ ok: true });
    expect(await l.take('p3', '2026-10-30', lim)).toEqual({ ok: false, limit: 'game' });
    expect(await l.take('p3', '2026-10-31', lim)).toEqual({ ok: true }); // a new day starts again
  });
  it('reading how many are left takes nothing and follows the smaller of the two rooms', async () => {
    const { db } = localD1(); const l = d1Ledger(db as never);
    expect(await l.left('p1', 'd', lim)).toBe(2); expect(await l.left('p1', 'd', lim)).toBe(2);
    await l.take('p1', 'd', lim); expect(await l.left('p1', 'd', lim)).toBe(1);
    await l.take('p2', 'd', lim); expect(await l.left('p3', 'd', lim)).toBe(1); // the game has one room left
    await l.take('p3', 'd', lim); expect(await l.left('p4', 'd', lim)).toBe(0);
  });
  it('a refused player does not use up a game slot, and a refund gives one back', async () => {
    const { db } = localD1(); const l = d1Ledger(db as never);
    await l.take('p1', 'd', lim); await l.take('p1', 'd', lim);
    await l.take('p1', 'd', lim); // refused by the player limit: the game slot is given back
    expect(await l.take('p2', 'd', lim)).toEqual({ ok: true });
    await l.refund('p2', 'd');
    expect(await l.take('p3', 'd', lim)).toEqual({ ok: true });
  });
  it('two requests at once cannot both take the last slot', async () => {
    const { db } = localD1(); const l = d1Ledger(db as never);
    const got = await Promise.all(Array.from({ length: 6 }, (_, i) => l.take(`p${i}`, 'd', { perPlayer: 3, perGame: 2 })));
    expect(got.filter((g) => g.ok)).toHaveLength(2);
  });
});

describe('the ledger holds no address', () => {
  it('the player key is a short code, never the IP', async () => {
    const { playerCode } = await import('../functions/api/object-lift');
    const a = await playerCode('203.0.113.7');
    expect(a).toMatch(/^[0-9a-f]{16}$/); expect(a).not.toContain('203'); expect(await playerCode('203.0.113.7')).toBe(a); expect(await playerCode('203.0.113.8')).not.toBe(a);
  });
});

describe('the world strip', () => {
  const base = { players: 1204, runs: 9310, clears: 311, countries: 14, totalClears: 5000, courses: {}, busiest: 'Training', record: null, hardest: null };
  it('shows nothing without runs, and the four tiles in order with them', async () => {
    const { tiles } = await import('../src/ui/world-stats');
    expect(tiles(null)).toEqual([]);
    expect(tiles({ ...base, runs: 0 })).toEqual([]);
    expect(tiles(base).map((t) => `${t.value} ${t.label}`)).toEqual(['1,204 players today', '9,310 runs today', '311 cleared today', '14 countries']);
    expect(tiles({ ...base, countries: 0 })).toHaveLength(3);
  });
  it('news: record, hardest zone, busiest course, streak', async () => {
    const { news } = await import('../src/ui/world-stats');
    const s = { ...base, record: { course: 'circular-quay-sydney', nick: 'ACE', ticks: 3240 }, hardest: { course: 'Training', zone: 'lache-2', fails: 41 } };
    expect(news(s, 3)).toEqual(['New record: ACE ran circular quay sydney in 27.0 s.', 'Hardest this week: lache 2 on Training (41 falls).', 'Busiest today: Training.', 'Your streak: 3 days in a row.']);
    expect(news(null, 1)).toEqual([]);
  });
  it('the streak grows by day, resets after a gap, and one run a day is one day', async () => {
    const { nextStreak, readStreak, touchStreak } = await import('../src/ui/streak');
    expect(nextStreak(null, '2026-10-30')).toEqual({ last: '2026-10-30', n: 1 });
    expect(nextStreak({ last: '2026-10-29', n: 4 }, '2026-10-30')).toEqual({ last: '2026-10-30', n: 5 });
    expect(nextStreak({ last: '2026-10-30', n: 5 }, '2026-10-30').n).toBe(5);
    expect(nextStreak({ last: '2026-10-27', n: 9 }, '2026-10-30').n).toBe(1);
    const m = new Map<string, string>(); const st = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } };
    const d = (x: string) => Date.parse(`${x}T12:00:00Z`);
    touchStreak(d('2026-10-29'), st); touchStreak(d('2026-10-30'), st);
    expect(readStreak(d('2026-10-30'), st)).toBe(2); expect(readStreak(d('2026-10-31'), st)).toBe(2); expect(readStreak(d('2026-11-02'), st)).toBe(0);
  });
  it('counts people, runs, clears, countries, the course numbers, the hardest zone and the newest record', async () => {
    const { onRequestGet } = await import('../functions/api/world-stats');
    const { db, sql } = localD1();
    const add = (s: string, r: string, e: string, ago: string, country = '', at = '') => sql.prepare("INSERT INTO course_events (ts, session, build, mode, source, course_key, course_name, run_id, event_type, country, fail_at) VALUES (datetime('now', ?), ?, 'b', 'course', 'demo', 'demo/training', 'Training', ?, ?, ?, ?)").run(ago, s, r, e, country, at);
    add('s1', 'r1', 'start', '-1 hour', 'SG'); add('s1', 'r1', 'success', '-1 hour', 'SG'); add('s2', 'r2', 'start', '-2 hours', 'FR'); add('s3', 'r3', 'start', '-3 days', 'US');
    for (let i = 0; i < 3; i++) add(`f${i}`, `rf${i}`, 'fail', '-2 days', '', 'lache-2');
    sql.prepare("INSERT INTO course_clears (ts, course_key, course_hash, ticks, run_id, log_hash, verified, nick) VALUES (datetime('now'), 'demo/training', 'h', 3000, 'ra', 'la', 1, 'ACE')").run();
    sql.prepare("INSERT INTO course_clears (ts, course_key, course_hash, ticks, run_id, log_hash, verified, nick) VALUES (datetime('now'), 'demo/training', 'h', 3500, 'rb', 'lb', 1, 'BOB')").run();
    const out = await (await onRequestGet({ env: { DB: db } as never })).json() as import('../functions/api/world-stats').WorldStats;
    expect(out).toMatchObject({ players: 2, runs: 2, clears: 1, countries: 2, totalClears: 2, busiest: 'Training' });
    expect(out.courses['demo/training']).toEqual({ runs: 2, clears: 1 });
    expect(out.record).toEqual({ course: 'training', nick: 'ACE', ticks: 3000 });
    expect(out.hardest).toEqual({ course: 'Training', zone: 'lache-2', fails: 3 });
  });
  it('before migration 0009 the strip still has its numbers', async () => {
    const { onRequestGet } = await import('../functions/api/world-stats');
    const { db } = localD1('0008');
    const out = await (await onRequestGet({ env: { DB: db } as never })).json() as { countries: number; hardest: unknown };
    expect(out.countries).toBe(0); expect(out.hardest).toBeNull();
  });
});

describe('Your best never goes stale (CC-108)', () => {
  it('run 1 = 35.2 s, run 2 = 35.0 s: the shown best is the faster one, from this browser or from the server', () => {
    const store = new Map<string, string>(), s = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    rememberBest('demo/training', 'h', 4224, s); expect(bestShown(readBest('demo/training', 'h', s), null)).toBe(4224);
    rememberBest('demo/training', 'h', 4200, s); expect(bestShown(readBest('demo/training', 'h', s), 4224)).toBe(4200);
    expect(bestShown(null, 4200)).toBe(4200); // a new browser: the server's answer is the best
    expect(bestShown(null, null)).toBeNull();
    expect(bestShown(4224, 4200)).toBe(4200);
  });
});
