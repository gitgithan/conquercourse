// CC-133: a waking or briefly unreachable Modal machine is retried and reported honestly, never as "down" at the first miss.
import { describe, expect, it, vi, afterEach } from 'vitest';
import { transient, withRetry, type Reply } from '../src/slice/object-lift-client';
import { suggestRegions } from '../src/slice/segment-client';

const r = (status: number, data: Record<string, unknown> = {}): Reply => ({ ok: status >= 200 && status < 400, status, data });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('transient answers', () => {
  it('a dropped connection and a bare 5xx are transient; a refusal with a reason is not', () => {
    expect(transient(r(0))).toBe(true);
    expect(transient(r(502))).toBe(true);
    expect(transient(r(429, { error: 'daily' }))).toBe(false);
    expect(transient(r(502, { error: 'down', message: 'busy' }))).toBe(false);
    expect(transient(r(200, { id: 'x' }))).toBe(false);
  });
  it('withRetry asks again after a wait and stops at the first good answer', async () => {
    const seq = [r(500), r(0), r(200, { id: 'fc-abc' })], waits: number[] = [];
    const out = await withRetry(async () => seq.shift() as Reply, undefined, async (ms) => { waits.push(ms); });
    expect(out.data.id).toBe('fc-abc'); expect(waits).toEqual([3000, 6000]);
  });
  it('withRetry gives up after two more tries and never retries a refusal', async () => {
    let n = 0; await withRetry(async () => { n++; return r(500); }, undefined, async () => undefined); expect(n).toBe(3);
    n = 0; await withRetry(async () => { n++; return r(403, { error: 'check', message: 'x' }); }, undefined, async () => undefined); expect(n).toBe(1);
  });
});

describe('segment submit', () => {
  const photo = { image: 'data:image/jpeg;base64,AAAA', thumb: 'data:image/jpeg;base64,AAAA', width: 10, height: 10, sha256: 'x' };
  it('says the outline finder (not the 3D service) is not answering after the retries', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(async (u: string) => (u.includes('turnstile-key') ? { ok: true, status: 200, json: async () => ({ siteKey: null }) } : { ok: false, status: 502, json: async () => { throw new Error('html'); } })));
    const p = suggestRegions(photo as never, () => undefined).catch((e: Error) => e);
    await vi.advanceTimersByTimeAsync(20000);
    const e = (await p) as Error;
    expect(e.message).toMatch(/outline finder is not answering/); expect(e.message).not.toMatch(/3D service/);
  });
  it('a first 502 then a good answer goes on to the job', async () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (u: string, init?: { body?: string }) => {
      if (u.includes('turnstile-key')) return { ok: true, status: 200, json: async () => ({ siteKey: null }) };
      const a = JSON.parse(init?.body ?? '{}').action; calls.push(a);
      if (a === 'submit') return calls.filter((c) => c === 'submit').length === 1 ? { ok: false, status: 502, json: async () => ({}) } : { ok: true, status: 200, json: async () => ({ id: 'fc-abcdefghijkl' }) };
      return { ok: true, status: 200, json: async () => ({ state: 'done', items: [], privacy: {} }) };
    }));
    const p = suggestRegions(photo as never, () => undefined);
    await vi.advanceTimersByTimeAsync(20000);
    expect(await p).toEqual([]); expect(calls.slice(0, 2)).toEqual(['submit', 'submit']);
  });
});
