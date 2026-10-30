// CC-108: the leaderboard, the player's tag, the personal best, and the D1 upload ledger (race-safe daily slots).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { courseHash, encodeLog, recordPlan } from '../src/sim/replay';
import { logTicks } from '../src/sim/run-checks';
import { onRequestPost as clearPost } from '../functions/api/course-clear';
import { onRequestGet as boardGet } from '../functions/api/leaderboard';
import { d1Ledger } from '../src/slice/d1-ledger';
import { boardLines, readBest, rememberBest } from '../src/ui/leaderboard';
import { assets, localD1 } from './helpers-d1';

const course = JSON.parse(readFileSync('public/assets/demo/training.course.json', 'utf8')) as CourseData;
const hash = courseHash(course);
const log = recordPlan(course, course.plan!, 120 * 120).recorder.snapshot();
const send = async (db: unknown, n: number, nick?: string) => {
  const body = { session: 'abcdef12-3456', runId: `run-0000000${n}`, courseKey: 'demo/training', hash, keys: await encodeLog(log), claimedTicks: logTicks(log), nick };
  return clearPost({ request: new Request('https://x/api/course-clear', { method: 'POST', headers: { 'cf-connecting-ip': `ip${n}` }, body: JSON.stringify(body) }), env: { DB: db, ASSETS: assets } as never });
};
const board = async (db: unknown, h = hash) => (await boardGet({ request: new Request(`https://x/api/leaderboard?course=demo/training&hash=${h}`), env: { DB: db } as never })).json() as Promise<{ top: { nick: string; ticks: number }[] }>;

describe('the leaderboard', () => {
  it('shows a verified run with its tag, and keeps the keys so it can be a ghost', async () => {
    const { db, sql } = localD1();
    expect((await send(db, 1, 'ace')).status).toBe(200);
    const top = (await board(db)).top;
    expect(top).toHaveLength(1); expect(top[0].nick).toBe('ACE');
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
