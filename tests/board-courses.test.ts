// CC-108: the four listed courses can each be published, ranked and replayed by the server (First Course, Training, Cannonballs, Two ways).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CourseData } from '../src/course/course';
import firstCourse from '../src/course/default-course.json';
import firstIdeal from '../src/course/default-course.ideal.json';
import { BOARD_COURSES, isBoardKey } from '../src/share/board-courses';
import { courseHash, encodeLog, recordPlan, verifyLog } from '../src/sim/replay';
import { logTicks, MAX_CLEAR_TICKS } from '../src/sim/run-checks';
import { onRequestPost as clearPost } from '../functions/api/course-clear';
import { onRequestGet as boardGet } from '../functions/api/leaderboard';
import { onRequestGet as runGet } from '../functions/api/leaderboard-run';
import { assets, localD1 } from './helpers-d1';

const load = (key: string): CourseData => key === 'default/first'
  ? firstCourse as unknown as CourseData
  : JSON.parse(readFileSync(`public/assets/${key}.course.json`, 'utf8')) as CourseData;

const planOf = (key: string, course: CourseData) => key === 'default/first' ? firstIdeal.plan : course.plan!; // the First Course keeps its ideal plan in a file of its own

describe('the listed courses', () => {
  it('are exactly the four the owner named', () => {
    expect(BOARD_COURSES.map((c) => c.key)).toEqual(['default/first', 'demo/training', 'demo/cannonballs', 'demo/two-ways']);
    expect(isBoardKey('demo/park-run')).toBe(false);
  });
  for (const { key, name } of BOARD_COURSES) {
    it(`${name}: the stored plan publishes, ranks, and the server replays the same time`, async () => {
      const course = load(key), hash = courseHash(course);
      const log = recordPlan(course, planOf(key, course), MAX_CLEAR_TICKS).recorder.snapshot();
      const keys = await encodeLog(log);
      const { db } = localD1();
      const body = { session: 'abcdef12-3456', runId: 'run-00000001', courseKey: key, hash, keys, claimedTicks: logTicks(log), nick: 'Ace', publish: true };
      const res = await clearPost({ request: new Request('https://x/api/course-clear', { method: 'POST', headers: { 'cf-connecting-ip': 'ip1' }, body: JSON.stringify(body) }), env: { DB: db, ASSETS: assets } as never });
      const out = await res.json() as Record<string, unknown>;
      expect(out, JSON.stringify(out)).toMatchObject({ ok: true, published: true, rank: 1 });
      const t0 = performance.now(), local = verifyLog(course, log, MAX_CLEAR_TICKS);
      expect(performance.now() - t0, 'the replay is cheap enough for one request').toBeLessThan(1000);
      expect(local.cleared).toBe(true);
      expect(out.ticks).toBe(local.ticks);
      const top = ((await (await boardGet({ request: new Request(`https://x/api/leaderboard?course=${key}&hash=${hash}&window=all`), env: { DB: db } as never })).json()) as { top: { id?: string; nick: string; ticks: number }[] }).top;
      expect(top).toHaveLength(1); expect(top[0]).toMatchObject({ nick: 'Ace', ticks: local.ticks });
      const run = await runGet({ request: new Request(`https://x/api/leaderboard-run?id=${top[0].id}`), env: { DB: db, ASSETS: assets } as never });
      expect(run.status).toBe(200);
    });
  }
  it('a deployment without the course file answers no-course, not a crash (Pages sends the home page with a 200 for a missing file)', async () => {
    const { db } = localD1();
    const homePage = { fetch: async () => new Response('<!doctype html><title>x</title>', { headers: { 'content-type': 'text/html' } }) };
    const body = { session: 'abcdef12-3456', runId: 'run-00000003', courseKey: 'demo/cannonballs', hash: 'abc', keys: 'x', publish: true };
    const res = await clearPost({ request: new Request('https://x/api/course-clear', { method: 'POST', headers: { 'cf-connecting-ip': 'ip3' }, body: JSON.stringify(body) }), env: { DB: db, ASSETS: homePage } as never });
    expect(res.status).toBe(404); expect(await res.json()).toMatchObject({ reason: 'no-course' });
  });
  it('anything unexpected answers with a short reason code, never an empty 500', async () => {
    const course = load('demo/training'), log = recordPlan(course, planOf('demo/training', course), MAX_CLEAR_TICKS).recorder.snapshot();
    const broken = { prepare: () => { throw new Error('D1_ERROR: no such table'); } };
    const body = { session: 'abcdef12-3456', runId: 'run-00000004', courseKey: 'demo/training', hash: courseHash(course), keys: await encodeLog(log), publish: true };
    const res = await clearPost({ request: new Request('https://x/api/course-clear', { method: 'POST', headers: { 'cf-connecting-ip': 'ip4' }, body: JSON.stringify(body) }), env: { DB: broken, ASSETS: assets } as never });
    expect(res.status).toBe(500); expect(await res.json()).toMatchObject({ reason: 'server-error', code: 'db-error' });
  });
  it('a course that is not listed cannot be published, and says why', async () => {
    const course = load('demo/training'), log = recordPlan(course, planOf('demo/training', course), MAX_CLEAR_TICKS).recorder.snapshot();
    const { db } = localD1();
    const body = { session: 'abcdef12-3456', runId: 'run-00000002', courseKey: 'demo/park-run', hash: 'abc', keys: await encodeLog(log), publish: true };
    const res = await clearPost({ request: new Request('https://x/api/course-clear', { method: 'POST', headers: { 'cf-connecting-ip': 'ip2' }, body: JSON.stringify(body) }), env: { DB: db, ASSETS: assets } as never });
    expect(res.status).toBe(422); expect(await res.json()).toMatchObject({ reason: 'not-listed' });
  });
});
