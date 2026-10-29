import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { courseHash, encodeLog, recordPlan } from '../src/sim/replay';
import { onRequestPost as clearPost } from '../functions/api/course-clear';
import { onRequestGet as statsGet } from '../functions/api/course-stats';
import { onRequestPost as eventPost } from '../functions/api/course-event';
import { DEMO_GROUPS } from '../src/ui/world-picker';
import { metaFor, cardPaths } from '../scripts/course-meta';
import {
  PRIOR_ATTEMPTS, MIN_ATTEMPTS_SHOWN, difficulty, dotsOf, observedScore, orderByDifficulty, priorScore, statKey, statsLine, statsOn,
  type CourseMeta, type CourseNumbers,
} from '../src/ui/course-stats';
import { assets, localD1 } from './helpers-d1';

const none: CourseNumbers = { plays: 0, fails: 0, clears: 0, best: null, median: null };
const meta: CourseMeta = { obstacles: 4, idealTicks: 1200 };

describe('difficulty from what players did (CC-149)', () => {
  it('with no attempts the designer order stands', () => {
    expect(difficulty(undefined, meta, 0.3)).toEqual({ score: 0.3, fromData: false });
    expect(difficulty({ ...none, plays: 40 }, meta, 0.3)).toEqual({ score: 0.3, fromData: false });
    const cards = ['a', 'b', 'c'].map((value, rank) => ({ value, key: value, rank, groupSize: 3 }));
    expect(orderByDifficulty(cards, {}, {}).map((c) => c.value)).toEqual(['a', 'b', 'c']);
  });
  it('a few attempts barely move the designer order, many attempts decide it', () => {
    const hardFew: CourseNumbers = { plays: 4, fails: 3, clears: 0, best: null, median: null };
    const hardMany: CourseNumbers = { plays: 400, fails: 300, clears: 0, best: null, median: null };
    const prior = 0.1;
    expect(difficulty(hardFew, meta, prior).score).toBeLessThan(difficulty(hardMany, meta, prior).score);
    const w = 3 / (3 + PRIOR_ATTEMPTS);
    expect(difficulty(hardFew, meta, prior).score).toBeCloseTo(w * observedScore(hardFew, meta)! + (1 - w) * prior, 9);
    expect(difficulty(hardFew, meta, prior).fromData).toBe(false); // too few to show a label
    expect(difficulty(hardMany, meta, prior).fromData).toBe(true);
    expect(MIN_ATTEMPTS_SHOWN).toBeGreaterThan(3);
  });
  it('more failures and a slower median both make a course harder', () => {
    const base: CourseNumbers = { plays: 100, fails: 20, clears: 60, best: 1300, median: 1500 };
    const more = observedScore({ ...base, fails: 60 }, meta)!, same = observedScore(base, meta)!;
    expect(more).toBeGreaterThan(same);
    expect(observedScore({ ...base, median: 2400 }, meta)!).toBeGreaterThan(same);
  });
  it('the same failure rate counts for more at each obstacle on a course with fewer obstacles', () => {
    const n: CourseNumbers = { plays: 100, fails: 50, clears: 50, best: 1300, median: 1300 };
    expect(observedScore(n, { obstacles: 2, idealTicks: 1300 })!).toBeGreaterThan(observedScore(n, { obstacles: 8, idealTicks: 1300 })!);
  });
  it('a course with no best line is judged on failures alone', () => {
    const n: CourseNumbers = { plays: 50, fails: 10, clears: 30, best: 900, median: 1000 };
    expect(observedScore(n, { obstacles: 3, idealTicks: null })).toBeGreaterThan(0);
  });
  it('extreme numbers stay between 0 and 1, and the dots between one and four', () => {
    const worst: CourseNumbers = { plays: 1e6, fails: 1e6, clears: 0, best: null, median: 1e9 };
    const best: CourseNumbers = { plays: 1e6, fails: 0, clears: 1e6, best: 1, median: 1 };
    for (const n of [worst, best]) { const s = observedScore(n, meta)!; expect(s).toBeGreaterThanOrEqual(0); expect(s).toBeLessThanOrEqual(1); }
    expect(observedScore(worst, meta)!).toBeGreaterThan(observedScore(best, meta)!);
    expect(dotsOf(-5)).toBe(1); expect(dotsOf(0.99)).toBe(4); expect(dotsOf(9)).toBe(4);
  });
  it('orders a group from easiest to hardest by the data, and keeps the menu order on a tie', () => {
    const cards = ['a', 'b', 'c'].map((value, rank) => ({ value, key: value, rank, groupSize: 3 }));
    const stats: Record<string, CourseNumbers> = {
      a: { plays: 900, fails: 600, clears: 200, best: 1300, median: 1900 },
      b: { plays: 900, fails: 20, clears: 700, best: 1250, median: 1300 },
      c: { plays: 900, fails: 300, clears: 400, best: 1250, median: 1500 },
    };
    const m = { a: meta, b: meta, c: meta };
    expect(orderByDifficulty(cards, stats, m).map((c) => c.value)).toEqual(['b', 'c', 'a']);
    expect(orderByDifficulty(cards, stats, m).map((c) => c.value)).toEqual(orderByDifficulty([...cards].reverse(), stats, m).map((c) => c.value)); // stable whatever order they arrive
    expect(priorScore(0, 5)).toBeCloseTo(0.1); expect(priorScore(4, 5)).toBeCloseTo(0.9); expect(priorScore(0, 1)).toBe(0.5);
  });
});

describe('the words on a card', () => {
  it('says nothing when there is nothing to say, and never a made-up number', () => {
    expect(statsLine(undefined)).toBeNull();
    expect(statsLine(none)).toBeNull();
    expect(statsLine({ ...none, fails: 9 })).toBeNull();
  });
  it('says plays, cleared and best time in plain words, and leaves out what is zero', () => {
    expect(statsLine({ plays: 1204, fails: 500, clears: 311, best: 4944, median: 6000 })).toBe('1,204 plays, 311 cleared, best 41.2 s');
    expect(statsLine({ ...none, plays: 1 })).toBe('1 play');
    expect(statsLine({ ...none, plays: 30 })).toBe('30 plays');
  });
  it('never mentions people', () => {
    expect(statsLine({ plays: 5, fails: 1, clears: 2, best: 100, median: 100 })).not.toMatch(/people|players|person/i);
  });
  it('?stats=0 turns the numbers off', () => {
    expect(statsOn(new URLSearchParams(''))).toBe(true);
    expect(statsOn(new URLSearchParams('stats=0'))).toBe(false);
    expect(statsOn(new URLSearchParams(''), false)).toBe(false);
  });
  it('the course name on a card is the name the course page uses in its events', () => {
    expect(statKey('/assets/demo/training.course.json')).toBe('demo/training');
    expect(statKey('/assets/experiments/osm/montmartre-paris.course.json')).toBe('experiments/osm/montmartre-paris');
  });
});

describe('course-meta.json (obstacles and best-line time of every card)', () => {
  const file = JSON.parse(readFileSync('public/assets/course-meta.json', 'utf8')) as Record<string, CourseMeta>;
  it('has a row for every course on a card and matches the course files (run npm run course-meta after a change)', () => {
    for (const p of cardPaths()) expect(file[statKey(p)], p).toEqual(metaFor(p));
    expect(Object.keys(file).length).toBe(cardPaths().length);
  });
  it('lists the card groups it knows', () => expect(DEMO_GROUPS.length).toBeGreaterThan(3));
});

describe('the server: clears are played again before they count', () => {
  const course = JSON.parse(readFileSync('public/assets/demo/training.course.json', 'utf8')) as CourseData;
  const hash = courseHash(course);
  const setup = () => localD1();
  const run = async () => encodeLog(recordPlan(course, course.plan!, 120 * 120).recorder.snapshot());
  const clear = async (db: unknown, body: Record<string, unknown>) => {
    const r = await clearPost({ request: new Request('https://x/api/course-clear', { method: 'POST', body: JSON.stringify(body) }), env: { DB: db, ASSETS: assets } as never });
    return { status: r.status, body: await r.json() as Record<string, unknown> };
  };
  const good = async () => ({ session: 'abcdef12-3456', runId: 'run-00000001', courseKey: 'demo/training', hash, keys: await run() });
  const stats = async (db: unknown) => (await (await statsGet({ env: { DB: db } as never })).json() as { courses: Record<string, CourseNumbers> }).courses;

  it('keeps a replayed clear with the simulator time, and no player id', async () => {
    const { db, sql } = setup();
    const r = await clear(db, await good());
    expect(r.status).toBe(200);
    const row = sql.prepare('SELECT * FROM course_clears').get() as Record<string, unknown>;
    expect(row.ticks).toBe(r.body.ticks);
    expect(row.ticks).toBeGreaterThan(1000);
    // 'keys' is the run log kept only for a run that beats the stored line (migration 0005, CC-176); it holds no player id
    expect(Object.keys(row).sort()).toEqual(['beats_ideal', 'course_hash', 'course_key', 'id', 'keys', 'log_hash', 'run_id', 'ticks', 'ts', 'verified']);
  });
  it('ignores a time the browser claims: only the keys count', async () => {
    const { db } = setup();
    const r = await clear(db, { ...(await good()), ticks: 5, time: 0.04 });
    expect(r.body.ticks).not.toBe(5);
    expect((await stats(db))['demo/training'].best).toBe(r.body.ticks);
  });
  it('refuses keys that do not clear the course', async () => {
    const { db } = setup();
    const half = await encodeLog(recordPlan(course, course.plan!, 120 * 120).recorder.snapshot().slice(0, 3));
    expect((await clear(db, { ...(await good()), keys: half })).status).toBe(422);
    expect((await clear(db, { ...(await good()), keys: 'dnot-real!' })).status).toBe(400);
    expect(Object.keys(await stats(db))).toEqual([]);
  });
  it('refuses a course that has changed, an unknown course and a bad id', async () => {
    const { db } = setup();
    expect((await clear(db, { ...(await good()), hash: 'zzzz' })).status).toBe(409);
    expect((await clear(db, { ...(await good()), courseKey: 'demo/not-a-course' })).status).toBe(404);
    expect((await clear(db, { ...(await good()), courseKey: '../../secret' })).status).toBe(400);
    expect((await clear(db, { ...(await good()), session: 'x' })).status).toBe(400);
  });
  it('counts the same run, or the same keys, once', async () => {
    const { db } = setup();
    const g = await good();
    await clear(db, g); await clear(db, g); await clear(db, { ...g, runId: 'run-00000002' });
    expect((await stats(db))['demo/training'].clears).toBe(1);
  });
  it('slows down a browser that sends a flood', async () => {
    const { db, sql } = setup();
    const ins = sql.prepare("INSERT INTO course_events (ts, session, build, mode, source, course_key, course_name, run_id, event_type) VALUES (datetime('now'), 'abcdef12-3456', 'b', 'course', 'demo', 'demo/training', 'x', ?, 'start')");
    for (let i = 0; i < 500; i++) ins.run(`run-${String(i).padStart(8, '0')}`);
    expect((await clear(db, await good())).status).toBe(429);
  });
  it('plays and failures come from the start and fail events; clears and best time from verified clears only', async () => {
    const { db } = setup();
    const ev = (event: string, runId: string) => eventPost({ request: new Request('https://x/api/course-event', { method: 'POST', body: JSON.stringify({ event, session: 'abcdef12-3456', runId, courseKey: 'demo/training', courseName: 'T', build: 'b', mode: 'course' }) }), env: { DB: db } as never });
    await ev('start', 'run-aaaaaaa1'); await ev('start', 'run-aaaaaaa2'); await ev('fail', 'run-aaaaaaa1'); await ev('success', 'run-aaaaaaa2'); // a success event alone is not a clear
    expect((await stats(db))['demo/training']).toEqual({ plays: 2, fails: 1, clears: 0, best: null, median: null });
    await clear(db, await good());
    const s = (await stats(db))['demo/training'];
    expect(s.plays).toBe(2); expect(s.clears).toBe(1); expect(s.best).toBe(s.median);
  });
  it('only the newest version of a course counts for the best time', async () => {
    const { db, sql } = setup();
    sql.exec("INSERT INTO course_clears (ts, course_key, course_hash, ticks, run_id, log_hash) VALUES (datetime('now'), 'demo/training', 'old', 100, 'run-old00001', 'o1')");
    await clear(db, await good());
    const s = (await stats(db))['demo/training'];
    expect(s.clears).toBe(1); expect(s.best).toBeGreaterThan(1000);
  });
});
