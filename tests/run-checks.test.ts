import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import { courseHash, encodeLog, recordPlan, type InputLog } from '../src/sim/replay';
import {
  BEATS_IDEAL_FACTOR, MAX_AVG_SPEED, MAX_CHANGES_PER_SECOND, MAX_CLEAR_TICKS, MIN_CLEAR_TICKS,
  beatsIdeal, changeStats, checkRun, logTicks, physicsFloorTicks, rateLimited,
} from '../src/sim/run-checks';
import { courseFiles, loadWithPlan } from '../scripts/run-checks-measure';
import { onRequestPost as clearPost } from '../functions/api/course-clear';
import { onRequestGet as statsGet } from '../functions/api/course-stats';
import { assets, localD1 } from './helpers-d1';

const stored = [...courseFiles('public/assets'), ...courseFiles('data')].flatMap((p) => { const c = loadWithPlan(p); return c ? [{ p, c }] : []; });
const meta = JSON.parse(readFileSync('public/assets/course-meta.json', 'utf8')) as Record<string, { idealTicks: number | null }>;
const plain = stored.flatMap(({ p, c }) => {
  const r = recordPlan(c, c.plan!, 120 * 180);
  return r.world.outcome === 'cleared' && r.recorder.valid ? [{ p, c, log: r.recorder.snapshot(), ticks: r.recorder.ticks }] : [];
});

describe('the pre-filter on real data (CC-174)', () => {
  it('finds the stored plans', () => expect(plain.length).toBeGreaterThan(25));
  it('every stored plan and ideal run passes the hard checks, and is not flagged against its own ideal', () => {
    for (const { p, c, log, ticks } of plain) {
      const v = checkRun({ log, course: c, idealTicks: ticks, claimedTicks: ticks });
      expect(v, p).toEqual({ ok: true, beatsIdeal: false });
      expect(ticks, p).toBeGreaterThanOrEqual(physicsFloorTicks(c));
      expect(ticks, p).toBeLessThanOrEqual(MAX_CLEAR_TICKS);
    }
  });
  it('the speed cap sits above the fastest best line and the key limits above the busiest', () => {
    const speeds = plain.map(({ c, ticks }) => (c.finishX - c.startX) / (ticks / 120));
    expect(Math.max(...speeds)).toBeLessThan(MAX_AVG_SPEED);
    expect(MAX_AVG_SPEED / Math.max(...speeds)).toBeGreaterThanOrEqual(1.04);
    expect(Math.max(...plain.map(({ log }) => changeStats(log).perSecond))).toBeLessThan(MAX_CHANGES_PER_SECOND / 4);
  });
  it('the 26.9 s Training clear and the card courses pass', () => {
    const t = plain.find((x) => x.p.endsWith('demo/training.course.json'))!;
    expect(t.ticks / 120).toBeGreaterThan(26.5);
    expect(checkRun({ log: t.log, course: t.c, idealTicks: meta['demo/training'].idealTicks }).ok).toBe(true);
    for (const [k, m] of Object.entries(meta)) {
      const x = plain.find((q) => q.p === `public/assets/${k}.course.json`);
      if (x && m.idealTicks) expect(checkRun({ log: x.log, course: x.c, idealTicks: m.idealTicks }), k).toMatchObject({ ok: true });
    }
  });
});

describe('what is rejected and what is only flagged', () => {
  const t = plain.find((x) => x.p.endsWith('demo/training.course.json'))!;
  const halved = (log: InputLog): InputLog => log.map(([m, n]) => [m, Math.max(1, n >> 1)]);
  it('a run too fast for the physics is rejected', () => {
    const v = checkRun({ log: halved(t.log), course: t.c, idealTicks: 3228 });
    expect(logTicks(halved(t.log)) / 120).toBeLessThan((t.c.finishX - t.c.startX) / MAX_AVG_SPEED);
    expect(v).toMatchObject({ ok: false, code: 'too-fast' });
  });
  it('a run only faster than the stored best line is NOT rejected: it is flagged for review and the replay decides', () => {
    expect(checkRun({ log: t.log, course: t.c, idealTicks: Math.round(t.ticks / 0.9) })).toEqual({ ok: true, beatsIdeal: true });
    expect(beatsIdeal(100, 100)).toBe(false);
    expect(beatsIdeal(99, 100)).toBe(false);
    expect(beatsIdeal(Math.floor(100 * BEATS_IDEAL_FACTOR) - 1, 100)).toBe(true);
    expect(beatsIdeal(1, null)).toBe(false);
  });
  it('too short, too long, a rate no hand can reach, and a broken log are rejected', () => {
    const c = { startX: 0, finishX: 1 };
    expect(checkRun({ log: [[1, MIN_CLEAR_TICKS - 1]], course: c })).toMatchObject({ code: 'too-short' });
    expect(checkRun({ log: [[1, MAX_CLEAR_TICKS + 1]], course: c })).toMatchObject({ code: 'too-long' });
    const mash: InputLog = Array.from({ length: 600 }, (_, i) => [i % 2 ? 0 : 1, 3] as [number, number]); // 40 changes a second
    expect(checkRun({ log: mash, course: { startX: 0, finishX: 1 } })).toMatchObject({ code: 'key-rate' });
    expect(checkRun({ log: [], course: c })).toMatchObject({ code: 'structure' });
    expect(checkRun({ log: [[1, 0]], course: c })).toMatchObject({ code: 'structure' });
    expect(checkRun({ log: [[1, 50], [1, 50]], course: c })).toMatchObject({ code: 'structure' });
    expect(checkRun({ log: [[1, 500]], course: c, claimedTicks: 100 })).toMatchObject({ code: 'structure' });
    expect(checkRun({ log: [[1, 500]], course: c, claimedTicks: 900 })).toMatchObject({ code: 'structure' });
    expect(checkRun({ log: [[1, 500]], course: c, claimedTicks: 450 })).toMatchObject({ ok: true });
  });
  it('a short claim cannot hide a fast run: the flag uses the smaller number', () => {
    expect(checkRun({ log: t.log, course: t.c, idealTicks: t.ticks, claimedTicks: t.ticks - 100 })).toEqual({ ok: true, beatsIdeal: true });
  });
  it('the address limiter lets the first runs in and slows the flood', () => {
    const h = new Map<string, number[]>();
    for (let i = 0; i < 20; i++) expect(rateLimited(h, 'ip', 1000 + i)).toBe(false);
    expect(rateLimited(h, 'ip', 2000)).toBe(true);
    expect(rateLimited(h, 'other', 2000)).toBe(false);
    expect(rateLimited(h, 'ip', 2000 + 600_001)).toBe(false);
  });
});

describe('the server, outcome by outcome', () => {
  const course = JSON.parse(readFileSync('public/assets/demo/training.course.json', 'utf8')) as CourseData;
  const hash = courseHash(course);
  const log = recordPlan(course, course.plan!, 120 * 120).recorder.snapshot();
  const base = async (n: number, keys?: string) => ({ session: 'abcdef12-3456', runId: `run-0000000${n}`, courseKey: 'demo/training', hash, keys: keys ?? await encodeLog(log), claimedTicks: logTicks(log) });
  const send = async (db: unknown, body: Record<string, unknown>, extra: Record<string, unknown> = {}, ip = 'a') => {
    const r = await clearPost({ request: new Request('https://x/api/course-clear', { method: 'POST', headers: { 'cf-connecting-ip': ip }, body: JSON.stringify(body) }), env: { DB: db, ASSETS: assets, ...extra } as never });
    return { status: r.status, body: await r.json() as Record<string, unknown> };
  };
  const stats = async (db: unknown) => (await (await statsGet({ env: { DB: db } as never })).json() as { courses: Record<string, { clears: number; best: number | null }> }).courses['demo/training'];

  it('impossible run: rejected, nothing stored, no replay needed', async () => {
    const { db, sql } = localD1();
    const fast = await encodeLog(log.map(([m, n]) => [m, Math.max(1, n >> 1)] as [number, number]));
    const r = await send(db, { ...(await base(1, fast)), claimedTicks: undefined }, {}, 'i1');
    expect(r.status).toBe(422); expect(r.body.code).toBe('too-fast');
    expect(sql.prepare('SELECT COUNT(*) AS n FROM course_clears').get()).toEqual({ n: 0 });
  });
  it('replay passes: verified, counted, sets the best time', async () => {
    const { db, sql } = localD1();
    const r = await send(db, await base(2), {}, 'i2');
    expect(r.status).toBe(200); expect(r.body).toMatchObject({ verified: true, beatsIdeal: false });
    expect(sql.prepare('SELECT verified, beats_ideal FROM course_clears').get()).toEqual({ verified: 1, beats_ideal: 0 });
    expect((await stats(db)).best).toBe(r.body.ticks);
    expect((await send(db, await base(2), {}, 'i2')).body.duplicate).toBe(true); // not replayed again
  });
  it('replay skipped or cut: kept unverified, counted as cleared, never a best time', async () => {
    const { db, sql } = localD1();
    const r = await send(db, await base(3), { REPLAY: 'off' }, 'i3');
    expect(r.status).toBe(202); expect(r.body).toMatchObject({ verified: false, stored: true });
    expect(sql.prepare('SELECT verified, ticks FROM course_clears').get()).toEqual({ verified: 0, ticks: 0 });
    expect(await stats(db)).toMatchObject({ clears: 1, best: null });
    // a later replay of the same run (the client sent it again) verifies it in place
    const again = await send(db, await base(3), {}, 'i3');
    expect(again.body.verified).toBe(true);
    expect(sql.prepare('SELECT COUNT(*) AS n FROM course_clears').get()).toEqual({ n: 1 });
    expect((await stats(db)).best).toBe(again.body.ticks);
  });
  it('a cut run that beats the stored best line is held out of the card until it is replayed', async () => {
    const { db, sql } = localD1();
    const fasterMeta = { fetch: async (u: string) => u.endsWith('course-meta.json') ? new Response(JSON.stringify({ 'demo/training': { idealTicks: logTicks(log) * 2 } })) : assets.fetch(u) };
    const r = await send(db, await base(4), { REPLAY: 'off', ASSETS: fasterMeta }, 'i4');
    expect(r.status).toBe(202);
    expect(sql.prepare('SELECT verified, beats_ideal FROM course_clears').get()).toEqual({ verified: 0, beats_ideal: 1 });
    expect((await stats(db))).toBeUndefined();
    const ok = await send(db, await base(4), { ASSETS: fasterMeta }, 'i4'); // replayed elsewhere: verified, flagged, a record
    expect(ok.body).toMatchObject({ verified: true, beatsIdeal: true });
    expect((await stats(db)).best).toBe(ok.body.ticks);
  });
  it('a verified run that beats the stored line keeps its keys (migration 0005); without the column nothing breaks', async () => {
    const fasterMeta = { fetch: async (u: string) => u.endsWith('course-meta.json') ? new Response(JSON.stringify({ 'demo/training': { idealTicks: logTicks(log) * 2 } })) : assets.fetch(u) };
    const { db, sql } = localD1();
    const ok = await send(db, await base(7), { ASSETS: fasterMeta }, 'i7');
    expect(ok.body).toMatchObject({ verified: true, beatsIdeal: true });
    expect((sql.prepare('SELECT keys FROM course_clears').get() as { keys: string }).keys.length).toBeGreaterThan(0);
    const plain = localD1();
    await send(plain.db, await base(8), {}, 'i8'); // b5326a5f (CC-108, migration 0012): an unpublished clear keeps no keys and no tag; only a published run or a flagged one does
    expect((plain.sql.prepare('SELECT keys FROM course_clears').get() as { keys: string | null }).keys).toBeNull();
    const before = localD1('0006'); // no nick column yet: a flagged run still keeps its keys, a plain one does not
    await send(before.db, await base(6), { ASSETS: fasterMeta }, 'i6');
    expect((before.sql.prepare('SELECT keys FROM course_clears').get() as { keys: string }).keys.length).toBeGreaterThan(0);
    const old = localD1('0004');
    const r = await send(old.db, await base(9), { ASSETS: fasterMeta }, 'i9');
    expect(r.body).toMatchObject({ verified: true, beatsIdeal: true });
  });
  it('before migration 0004 the endpoint and the card work as they did: replayed clears kept, unverified ones not', async () => {
    const { db, sql } = localD1('0003');
    expect((await send(db, await base(6), { REPLAY: 'off' }, 'i6')).body).toMatchObject({ verified: false, stored: false });
    expect(sql.prepare('SELECT COUNT(*) AS n FROM course_clears').get()).toEqual({ n: 0 });
    const r = await send(db, await base(6), {}, 'i6');
    expect(r.status).toBe(200);
    expect((await stats(db)).best).toBe(r.body.ticks);
  });
  it('one address cannot make the server replay without end', async () => {
    const { db } = localD1();
    let last = 0;
    for (let i = 0; i < 22; i++) last = (await send(db, { ...(await base(1)), runId: `run-flood${i}00` }, { REPLAY: 'off' }, 'flooder')).status;
    expect(last).toBe(429);
  });
});
