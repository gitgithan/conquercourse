// CC-108: non-overlapping UTC windows, one best time per player, your place, and the last window's champion.
import { describe, expect, it } from 'vitest';
import { nextReset, previousStart, sqlTime, untilText, windowStart } from '../src/share/windows';
import { board } from '../functions/api/leaderboard';
import { placeText, resetText } from '../src/ui/leaderboard';
import { localD1 } from './helpers-d1';

const T = Date.UTC(2026, 9, 30, 15, 30); // Friday 2026-10-30 15:30 UTC

describe('windows', () => {
  it('the day starts at 00:00 UTC and the week on Monday', () => {
    expect(new Date(windowStart('day', T)).toISOString()).toBe('2026-10-30T00:00:00.000Z');
    expect(new Date(windowStart('week', T)).toISOString()).toBe('2026-10-26T00:00:00.000Z');
    expect(windowStart('all', T)).toBe(0);
  });
  it('windows do not overlap: the reset moment starts the next one', () => {
    const r = nextReset('day', T)!;
    expect(windowStart('day', r)).toBe(r);
    expect(windowStart('day', r - 1)).toBe(windowStart('day', T));
    const w = nextReset('week', T)!;
    expect(new Date(w).toISOString()).toBe('2026-11-02T00:00:00.000Z');
    expect(nextReset('all', T)).toBeNull();
    expect(new Date(previousStart('day', T)).toISOString()).toBe('2026-10-29T00:00:00.000Z');
  });
  it('words for the clock', () => {
    expect(untilText(5 * 3600_000 + 12 * 60_000)).toBe('5 h 12 m');
    expect(untilText(30 * 60_000)).toBe('30 m');
    expect(resetText(T + 3 * 86_400_000 + 4 * 3600_000, T)).toBe('Resets in 3 d 4 h');
    expect(resetText(null)).toBe('');
  });
});

describe('boards by window', () => {
  const put = (sql: ReturnType<typeof localD1>['sql'], run: string, player: string, ticks: number, at: number, nick = 'AAA') =>
    sql.prepare("INSERT INTO course_clears (ts, course_key, course_hash, ticks, verified, run_id, log_hash, nick, player, published) VALUES (?, 'demo/training', 'h1', ?, 1, ?, ?, ?, ?, 1)").run(sqlTime(at), ticks, run, `log-${run}`, nick, player);
  it('counts one best time per player, ranks you, and names the last window champion', async () => {
    const { db, sql } = localD1();
    const cols = (sql.prepare('PRAGMA table_info(course_clears)').all() as { name: string }[]).map((c) => c.name);
    expect(cols).toContain('player');
    put(sql, 'r1', 'p1', 3000, T - 1000, 'ONE'); put(sql, 'r2', 'p1', 2800, T - 2000, 'ONE'); // same player twice: only 2800 counts
    put(sql, 'r3', 'p2', 3200, T - 3000, 'TWO'); put(sql, 'r4', 'p3', 3100, T - 4000, 'TRI');
    put(sql, 'r5', 'p4', 2500, T - 86_400_000, 'OLD'); // yesterday: not in today, is yesterday's champion
    const day = await board({ DB: db } as never, 'demo/training', 'h1', 'day', T, '');
    expect(day.players).toBe(3); expect(day.top.map((r) => r.nick)).toEqual(['ONE', 'TRI', 'TWO']); expect(day.top[0].ticks).toBe(2800);
    expect(day.previous).toEqual({ nick: 'OLD', ticks: 2500 });
    expect(day.resetAt).toBe(nextReset('day', T));
    const all = await board({ DB: db } as never, 'demo/training', 'h1', 'all', T, '');
    expect(all.players).toBe(4); expect(all.top[0].nick).toBe('OLD'); expect(all.previous).toBeNull();
    const me = await board({ DB: db } as never, 'demo/training', 'h1', 'day', T, 'p3');
    expect(me.mine).toEqual({ rank: 2, ticks: 3100 });
    expect(placeText(me)).toBe('You are #2 of 3 players');
  });
});
