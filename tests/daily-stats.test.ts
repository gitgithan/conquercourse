// CC-108: the daily growth numbers: day buckets, zero fill, ranges, and SQL that only ever binds.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dayList, isEmpty, linePoints, niceMax, sliceRange, zeroFill, type DailyStats } from '../src/slice/daily-stats';
import { QUERIES, dailyStats, onRequestGet } from '../functions/api/daily-stats';
import { localD1 } from './helpers-d1';

const NOW = Date.parse('2026-10-31T10:00:00Z');

describe('day buckets', () => {
  it('lists every day, oldest first, ends included', () => {
    expect(dayList('2026-10-29', '2026-10-31')).toEqual(['2026-10-29', '2026-10-30', '2026-10-31']);
    expect(dayList('2026-10-31', '2026-10-31')).toEqual(['2026-10-31']);
    expect(dayList('2026-02-27', '2026-03-02')).toHaveLength(4);
  });
  it('keeps at most a year and survives bad input', () => {
    expect(dayList('2020-01-01', '2026-10-31')).toHaveLength(365);
    expect(dayList('nonsense', '2026-10-31')).toEqual(['2026-10-31']);
    expect(dayList('2026-11-05', '2026-10-31')).toEqual(['2026-10-31']);
  });
  it('fills the missing days with 0 and drops rows outside the list', () => {
    const days = dayList('2026-10-29', '2026-10-31');
    expect(zeroFill(days, [{ d: '2026-10-29', n: 3 }, { d: '2026-10-31', n: 5 }, { d: '2025-01-01', n: 9 }, { d: 'x', n: 1 }, { d: '2026-10-30', n: 'bad' }])).toEqual([3, 0, 5]);
  });
  it('adds two rows of the same day (two sources of assets)', () => {
    expect(zeroFill(['2026-10-31'], [{ d: '2026-10-31', n: 2 }, { d: '2026-10-31', n: 3 }])).toEqual([5]);
  });
});

describe('range and chart', () => {
  const d: DailyStats = { days: Array.from({ length: 40 }, (_, i) => `d${i}`), series: { players: Array.from({ length: 40 }, (_, i) => i), runs: Array(40).fill(1), assets: Array(40).fill(0), clears: Array(40).fill(2) } };
  it('slices the newest days of every series together', () => {
    expect(sliceRange(d, '7').days).toHaveLength(7);
    expect(sliceRange(d, '7').series.players).toEqual([33, 34, 35, 36, 37, 38, 39]);
    expect(sliceRange(d, '30').series.runs).toHaveLength(30);
    expect(sliceRange(d, 'all').days).toHaveLength(40);
    expect(sliceRange({ days: ['a', 'b'], series: { players: [1, 2], runs: [0, 0], assets: [0, 0], clears: [0, 0] } }, '30').days).toHaveLength(2);
  });
  it('knows an empty game', () => {
    expect(isEmpty(null)).toBe(true);
    expect(isEmpty({ days: ['a'], series: { players: [0], runs: [0], assets: [0], clears: [0] } })).toBe(true);
    expect(isEmpty(d)).toBe(false);
  });
  it('rounds the top of the axis and draws one flat day', () => {
    expect([niceMax(0), niceMax(3), niceMax(7), niceMax(12), niceMax(140), niceMax(900)]).toEqual([1, 5, 10, 20, 200, 1000]);
    expect(linePoints([0, 5, 10], 100, 50, 10)).toBe('0.0,50.0 50.0,25.0 100.0,0.0');
    expect(linePoints([4], 100, 50)).toBe('0.0,10.0');
  });
});

describe('the endpoint on a real database', () => {
  it('counts per day, with players as distinct codes, and returns no person', async () => {
    const { db, sql } = localD1();
    const ev = (ts: string, session: string, run: string, type = 'start') => sql.prepare("INSERT INTO course_events (ts, session, build, mode, source, course_key, course_name, run_id, event_type) VALUES (?, ?, 'b', 'm', 's', 'demo/training', 'Training', ?, ?)").run(ts, session, run, type);
    ev('2026-10-30 09:00:00', 'sess-aaaaaaaa', 'run-00000001'); ev('2026-10-31 09:00:00', 'sess-aaaaaaaa', 'run-00000002'); ev('2026-10-31 09:05:00', 'sess-aaaaaaaa', 'run-00000003'); ev('2026-10-31 09:06:00', 'sess-bbbbbbbb', 'run-00000004'); ev('2026-10-31 09:07:00', 'sess-bbbbbbbb', 'run-00000004', 'success');
    sql.prepare("INSERT INTO upload_days (day, player, n) VALUES ('2026-10-31', '*', 4), ('2026-10-31', 'someone', 2)").run();
    sql.prepare("INSERT INTO community (ts, session, name, nick, width, height, boxes, image) VALUES ('2026-10-31 08:00:00', 's', 'n', 'k', 1, 1, '[]', '')").run();
    const out = await dailyStats(db as never, NOW);
    expect(out.days).toEqual(['2026-10-30', '2026-10-31']);
    expect(out.series.players).toEqual([1, 2]);
    expect(out.series.runs).toEqual([1, 3]);
    expect(out.series.assets).toEqual([0, 5]);
    expect(out.series.clears).toEqual([0, 0]);
    const text = JSON.stringify(out);
    expect(text).not.toMatch(/sess-|someone|demo\/training/);
    const res = await onRequestGet({ env: { DB: db as never } });
    expect(res.headers.get('cache-control')).toContain('max-age=300');
  });
  it('is one empty day on a new game and survives a missing table', async () => {
    const { db } = localD1('0001');
    const out = await dailyStats(db as never, NOW);
    expect(out.days).toEqual(['2026-10-31']);
    expect(out.series.runs).toEqual([0]);
  });
});

describe('SQL safety', () => {
  it('every query is fixed text with one ? to bind and nothing joined in', () => {
    for (const sql of Object.values(QUERIES).flat()) {
      expect(sql.match(/\?/g)).toHaveLength(1);
      expect(sql).not.toMatch(/\$\{|\+ ?['"`]/);
    }
    const src = readFileSync('functions/api/daily-stats.ts', 'utf8');
    expect(src).not.toMatch(/searchParams|request\./); // the route reads nothing from the caller
    expect(src).toMatch(/\.bind\(since\)/);
  });
});
