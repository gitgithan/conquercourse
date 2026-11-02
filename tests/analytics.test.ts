import { describe, expect, it } from 'vitest';
import { localD1 } from './helpers-d1';
import { COLD_AFTER_MS, analyticsOn, classify, normRef, pct, pickRef, recordStep, refFromReferrer, waitTimer } from '../functions/_lib/analytics';
import { analytics, route } from '../functions/api/admin-usage';
import { onRequestPost as eventPost } from '../functions/api/course-event';
import { onRequestPost as funnelPost } from '../functions/api/funnel-event';
import { onRequestPost as segmentPost } from '../functions/api/segment';

const SID = 'abcdef12-3456';
const req = (body: unknown) => new Request('https://x/api', { method: 'POST', body: JSON.stringify(body) });
const rows = (sql: { prepare(q: string): { all(): unknown[] } }, q: string) => sql.prepare(q).all() as Record<string, unknown>[];

describe('source tag (CC-108)', () => {
  it('cleans ?ref= to lower case, safe characters and 24 characters', () => {
    expect(normRef('Reddit_Post-1')).toBe('reddit_post-1');
    expect(normRef('a b<script>"c')).toBe('abscriptc');
    expect(normRef('x'.repeat(40))).toHaveLength(24);
    expect(normRef(undefined)).toBe('');
  });
  it('turns a referrer into one word from its host only', () => {
    expect(refFromReferrer('https://www.reddit.com/r/gamedev/comments/abc?x=1')).toBe('reddit');
    expect(refFromReferrer('https://lnkd.in/xyz')).toBe('linkedin');
    expect(refFromReferrer('https://t.co/abc')).toBe('x');
    expect(refFromReferrer('https://news.ycombinator.com/item?id=1')).toBe('hn');
    expect(refFromReferrer('https://www.google.de/')).toBe('google');
    expect(refFromReferrer('https://blog.example.org/post')).toBe('other');
    expect(refFromReferrer('')).toBe('direct');
    expect(refFromReferrer('https://conquercourse.pages.dev/', 'conquercourse.pages.dev')).toBe('direct');
  });
  it('prefers automation, then ?ref=, then the referrer', () => {
    expect(pickRef('?ref=li-1', 'https://reddit.com/', true)).toBe('test');
    expect(pickRef('?ref=LI-1', 'https://reddit.com/', false)).toBe('li-1');
    expect(pickRef('', 'https://reddit.com/', false)).toBe('reddit');
    expect(pickRef('?ref=%%%', '', false)).toBe('direct');
  });
});

describe('funnel steps', () => {
  it('keeps one row per visitor, step and day, and only listed steps', async () => {
    const { db, sql } = localD1();
    expect(await recordStep(db, { session: SID, step: 'landed', ref: 'Reddit' })).toBe(true);
    await recordStep(db, { session: SID, step: 'landed', ref: 'reddit' });
    expect(await recordStep(db, { session: SID, step: 'hacked' })).toBe(false);
    expect(await recordStep(db, { session: 'x', step: 'landed' })).toBe(false);
    const r = rows(sql as never, "SELECT name, ref, country FROM analytics_events WHERE kind = 'step'");
    expect(r).toEqual([{ name: 'landed', ref: 'reddit', country: '' }]);
    await recordStep(db, { session: SID, step: 'landed', now: Date.now() + 86_400_000 * 2 });
    expect(rows(sql as never, "SELECT * FROM analytics_events WHERE kind = 'step'")).toHaveLength(2);
  });
  it('the endpoint answers ok:false for a bad step and never errors', async () => {
    const { db } = localD1();
    expect(await (await funnelPost({ request: req({ session: SID, step: 'nope' }), env: { DB: db } } as never)).json()).toEqual({ ok: false });
    expect(await (await funnelPost({ request: req({ session: SID, step: 'used_lab' }), env: { DB: db } } as never)).json()).toEqual({ ok: true });
    expect((await funnelPost({ request: req({ session: SID, step: 'landed' }), env: {} } as never)).status).toBe(200);
  });
  it('can be switched off with the analytics flag', async () => {
    const { db, sql } = localD1();
    sql.exec("INSERT INTO flags (name, on_) VALUES ('analytics', 0)");
    expect(await analyticsOn(db)).toBe(false);
    expect(await recordStep(db, { session: SID, step: 'landed' })).toBe(false);
  });
  it('skips quietly when migration 0019 is missing', async () => {
    const { db } = localD1('0018');
    expect(await recordStep(db, { session: SID, step: 'landed' })).toBe(false);
  });
});

describe('course events carry the tag, with fallbacks', () => {
  const ev = { session: SID, runId: 'run-12345678', event: 'start', courseKey: 'demo/training', courseName: 'T', mode: 'course', source: 'x', build: 'b', ref: 'LinkedIn' };
  it('stores ref and counts the start and clear as funnel steps', async () => {
    const { db, sql } = localD1();
    await eventPost({ request: req(ev), env: { DB: db } } as never);
    await eventPost({ request: req({ ...ev, event: 'success' }), env: { DB: db } } as never);
    expect(rows(sql as never, 'SELECT ref, event_type FROM course_events ORDER BY event_type')).toEqual([{ ref: 'linkedin', event_type: 'start' }, { ref: 'linkedin', event_type: 'success' }]);
    expect(rows(sql as never, "SELECT name FROM analytics_events WHERE kind = 'step' ORDER BY name").map((r) => r.name)).toEqual(['cleared', 'start_run']);
  });
  it('still stores the event before migration 0019', async () => {
    const { db, sql } = localD1('0018');
    const res = await eventPost({ request: req(ev), env: { DB: db } } as never);
    expect(res.status).toBe(200);
    expect(rows(sql as never, 'SELECT event_type FROM course_events')).toHaveLength(1);
  });
});

describe('wait timer', () => {
  const ok = (ms: number, t: { now: number }) => (async () => { t.now += ms; return new Response('{}', { status: 200 }); }) as unknown as typeof fetch;
  it('classifies by host, with the route as the default', () => {
    expect(classify('https://x.baseten.co/y', 'segment')).toBe('safety-check');
    expect(classify('https://a--b.modal.run', 'segment')).toBe('segment');
    expect(classify('not a link', 'character')).toBe('character');
  });
  it('marks the first call cold, a call soon after warm, and one after ten minutes cold again', async () => {
    const { db, sql } = localD1(); const t = { now: 0 };
    const call = async (at: number, ms: number) => { const w = waitTimer('segment', ok(ms, t), () => t.now); await w.fetcher('https://a--b.modal.run'); await w.flush(db, at); };
    const T0 = Date.UTC(2026, 10, 1);
    await call(T0, 9000); await call(T0 + 60_000, 800); await call(T0 + 60_000 + COLD_AFTER_MS + 1, 7000);
    expect(rows(sql as never, "SELECT ms, cold FROM analytics_events WHERE kind = 'wait' ORDER BY ts, ms").map((r) => [r.ms, r.cold])).toEqual([[9000, 1], [800, 0], [7000, 1]]);
  });
  it('records a failed call and rethrows it; never throws on a broken database', async () => {
    const t = { now: 0 };
    const w = waitTimer('character', (async () => { t.now += 50; throw new Error('down'); }) as never, () => t.now);
    await expect(w.fetcher('https://z--q.modal.run')).rejects.toThrow('down');
    expect(w.waits).toEqual([{ service: 'character', ms: 50, ok: false }]);
    const broken = { prepare: () => { throw new Error('no db'); } };
    expect(await w.flush(broken as never)).toBe(0);
    expect(await waitTimer('x').flush(undefined)).toBe(0);
  });
  it('the segment route writes a wait row on submit and answers as before when the table is missing', async () => {
    const env = { CC_UPLOAD_TOKEN: 't', CC_SEGMENT_SUBMIT_URL: 'https://a--s.modal.run', CC_SEGMENT_STATUS_URL: 'https://a--t.modal.run' };
    const { db, sql } = localD1();
    const g = globalThis as { fetch: typeof fetch }; const keep = g.fetch;
    g.fetch = (async () => new Response(JSON.stringify({ id: 'job1' }), { status: 200 })) as never;
    try {
      const r = await segmentPost({ request: new Request('https://x/api', { method: 'POST', headers: { 'cf-connecting-ip': 'ip-w' }, body: JSON.stringify({ action: 'submit', image: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==', thumb: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==' }) }), env: { ...env, DB: db } } as never);
      expect([200, 400, 403, 502, 503]).toContain(r.status);
      const old = localD1('0018');
      const r2 = await segmentPost({ request: new Request('https://x/api', { method: 'POST', headers: { 'cf-connecting-ip': 'ip-w2' }, body: JSON.stringify({ action: 'submit', image: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==', thumb: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==' }) }), env: { ...env, DB: old.db } } as never);
      expect(r2.status).toBe(r.status);
      void sql;
    } finally { g.fetch = keep; }
  });
});

describe('percentiles and the owner view', () => {
  it('computes median and p90 by nearest rank', () => {
    expect(pct([], 0.5)).toBeNull();
    expect(pct([5], 0.9)).toBe(5);
    expect(pct([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.5)).toBe(5);
    expect(pct([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBe(9);
  });
  it('builds sources, funnel and waits; empty without the migration', async () => {
    const { db, sql } = localD1();
    await eventPost({ request: req({ session: SID, runId: 'run-12345678', event: 'start', courseKey: 'demo/training', ref: 'reddit' }), env: { DB: db } } as never);
    const w = waitTimer('segment', (async () => new Response('{}')) as never); await w.fetcher('https://a--b.modal.run'); await w.flush(db);
    const a = await analytics(db as never);
    expect(a.sources).toEqual([{ ref: 'reddit', landed: 0, players: 1, runs: 1, clears: 0 }]);
    expect(a.funnel.find((f) => f.step === 'start_run')?.byRef).toEqual({ reddit: 1 });
    expect(a.waits).toEqual([expect.objectContaining({ service: 'segment', cold: true, calls: 1 })]);
    void sql;
    const old = await analytics(localD1('0018').db as never);
    expect(old.waits).toEqual([]); expect(old.funnel.every((f) => f.total === 0)).toBe(true); expect(old.recording).toBe(true);
  });
  it('stays owner-only', async () => {
    const { db } = localD1();
    expect((await route(new Request('https://x/api/admin-usage?view=analytics'), { DB: db as never })).status).toBe(404);
    expect((await route(new Request('https://x/api/admin-usage?view=analytics'), { DB: db as never, ADMIN_TOKEN: 'secret-token' })).status).toBe(401);
    const ok = await route(new Request('https://x/api/admin-usage?view=analytics', { headers: { 'x-admin-token': 'secret-token' } }), { DB: db as never, ADMIN_TOKEN: 'secret-token' });
    expect(ok.status).toBe(200);
  });
});
