// CC-219: a refusal for "too many" says when to come back, and the player reads it in plain words.
import { describe, expect, it } from 'vitest';
import { countdownLabel, secondsUntilFree, shareWaitText, slowDownReply, waitFromReply, waitWords } from '../src/sim/slow-down';
import { rateLimited, rateWaitSeconds, REPLAY_WINDOW_MS } from '../src/sim/run-checks';
import { createShare, SHARES_PER_ADDRESS, SHARES_PER_HOUR, type ShareRow, type ShareStore } from '../src/share/server';
import { makeChallengeParam, recordPlan, type InputLog } from '../src/sim/replay';
import { makeLinkInfo } from '../src/share/challenge';
import { loadDemo as load } from './helpers/course';
import type { CourseData } from '../src/course/course';

const lache = load('lache.course.json');
const logOf = (c: CourseData): InputLog => recordPlan(c, c.plan!, 120 * 120).recorder.snapshot();
const NOW = 1_800_000_000_000;

describe('the words', () => {
  it('rounds the wait up and speaks in seconds, then minutes', () => {
    expect(waitWords(1)).toBe('a few seconds');
    expect(waitWords(38)).toBe('about 40 seconds');
    expect(waitWords(59)).toBe('about 60 seconds');
    expect(waitWords(60)).toBe('about 1 minute');
    expect(waitWords(91)).toBe('about 2 minutes');
    expect(waitWords(60 * 59 + 1)).toBe("about 60 minutes");
  });
  it('the sentence says the run is safe and when to try again', () => {
    expect(shareWaitText(38)).toBe('Too many shares just now. Your run is safe: try again in about 40 seconds.');
  });
  it('the button counts down in seconds, then minutes', () => {
    expect(countdownLabel(38)).toBe('38 s');
    expect(countdownLabel(0.2)).toBe('1 s');
    expect(countdownLabel(300)).toBe('5 min');
  });
});

describe('the wait', () => {
  it('is the time until the oldest hit leaves the window, from a stubbed clock', () => {
    const hits = new Map<string, number[]>([['a', [NOW - 9 * 60_000, NOW - 60_000]]]);
    expect(secondsUntilFree(hits.get('a')!, NOW, REPLAY_WINDOW_MS)).toBe(60);
    expect(rateWaitSeconds(hits, 'a', NOW)).toBe(60);
    expect(rateWaitSeconds(hits, 'a', NOW + 30_500)).toBe(30);
    expect(rateWaitSeconds(hits, 'nobody', NOW)).toBe(1);
  });
  it('never promises more than an hour and never less than one second', () => {
    expect(slowDownReply(99_999).body.retryAfterSeconds).toBe(3600);
    expect(slowDownReply(0).body.retryAfterSeconds).toBe(1);
  });
  it('reads the body first, then the header, and gives a 429 with no number a safe wait', () => {
    expect(waitFromReply(429, { retryAfterSeconds: 42 }, '7')).toBe(42);
    expect(waitFromReply(429, {}, '7')).toBe(7);
    expect(waitFromReply(429, {}, null)).toBe(60);
    expect(waitFromReply(200, { retryAfterSeconds: 42 })).toBeNull();
  });
});

function store(rows: ShareRow[] = []): ShareStore {
  const m = new Map<string, ShareRow>(rows.map((r, i) => [`x${i}`, r]));
  return {
    byContentHash: async () => null, insert: async (r) => { m.set(r.id, r); return true; }, get: async (id) => m.get(id) ?? null,
    countSince: async (t) => [...m.values()].filter((r) => r.created_at > t).length,
    oldestSince: async (t) => { const x = [...m.values()].filter((r) => r.created_at > t).map((r) => r.created_at); return x.length ? Math.min(...x) : null; },
  };
}
const body = async (nick: string) => JSON.stringify({ param: await makeChallengeParam(lache, logOf(lache), nick, 'done'), query: 'course=/assets/demo/lache.course.json' });
const envOf = (s: ShareStore, hits = new Map<string, number[]>(), now = NOW) => ({ store: s, hits, now: () => now, address: '1.2.3.4', randomBytes: (k: number) => crypto.getRandomValues(new Uint8Array(k)), loadCourse: async (key: string) => (key === 'demo/lache' ? lache : null) });

describe('the server refusal', () => {
  it('one address: 429 with Retry-After equal to the body and the real reset', async () => {
    const hits = new Map<string, number[]>([['1.2.3.4', Array.from({ length: SHARES_PER_ADDRESS }, (_, i) => NOW - 8 * 60_000 + i)]]);
    const r = await createShare(envOf(store(), hits), await body('AAA'));
    expect(r.status).toBe(429);
    expect(r.body.reason).toBe('slow_down');
    expect(r.body.retryAfterSeconds).toBe(120);
    expect(r.headers?.['retry-after']).toBe('120');
  });
  it('the whole site: waits until the oldest share of the hour is out of the window', async () => {
    const nowS = NOW / 1000;
    const rows = Array.from({ length: SHARES_PER_HOUR }, (_, i) => ({ created_at: nowS - 3000 + (i % 10) } as ShareRow));
    const r = await createShare(envOf(store(rows)), await body('BBB'));
    expect(r.status).toBe(429);
    expect(r.body.retryAfterSeconds).toBe(600);
    expect(r.headers?.['retry-after']).toBe('600');
  });
  it('rateLimited itself is unchanged: it says yes only when full', () => {
    const hits = new Map<string, number[]>();
    for (let i = 0; i < 3; i++) expect(rateLimited(hits, 'k', NOW + i, 3)).toBe(false);
    expect(rateLimited(hits, 'k', NOW + 5, 3)).toBe(true);
  });
});

describe('the page when the server asks for a pause', () => {
  const search = '?course=/assets/demo/lache.course.json';
  const busy = (async () => new Response(JSON.stringify({ error: 'slow down', reason: 'slow_down', retryAfterSeconds: 38 }), { status: 429, headers: { 'retry-after': '38' } })) as unknown as typeof fetch;
  it('hands back no link and says how long to wait', async () => {
    const r = await makeLinkInfo('https://conquercourse.pages.dev', search, lache, logOf(lache), '', 'a', 'done', busy);
    expect(r.wait).toBe(38);
    expect(r.url).toBeNull();
    expect(r.down).toBeFalsy();
  });
  it('no wait is reported when the server is simply down; it says so', async () => {
    const down = (async () => new Response('{}', { status: 503 })) as unknown as typeof fetch;
    const r = await makeLinkInfo('https://x.test', search, lache, logOf(lache), '', 'a', 'done', down);
    expect(r.wait).toBeNull(); expect(r.down).toBe(true);
  });
});
