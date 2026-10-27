import { describe, expect, it } from 'vitest';
import { onRequestPost } from '../functions/api/submit';

// A tiny stand-in for D1: remembers inserts and answers the rate-limit query.
function fakeDb(recent = 0) {
  const rows: unknown[][] = [];
  const db = { prepare: (sql: string) => ({ bind: (...v: unknown[]) => ({
    run: async () => { rows.push(v); return {}; },
    first: async () => (sql.startsWith('SELECT') ? { n: recent } : null),
  }) }) };
  return { db, rows };
}
const post = (body: unknown, recent = 0) => {
  const { db, rows } = fakeDb(recent);
  const req = new Request('https://x/api/submit', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });
  return onRequestPost({ request: req, env: { DB: db } as never }).then(async (r) => ({ status: r.status, body: await r.json(), rows }));
};
const ok = { round: 'public-1', session: 'abcdef12-3456', build: 'abc 2026-10-27', mode: 'course', answers: { clear: 4, confusing: 'the wall' }, context: { falls: 3 } };

describe('feedback endpoint', () => {
  it('stores a good submission', async () => {
    const r = await post(ok);
    expect(r.status).toBe(200);
    expect(r.rows.length).toBe(1);
  });
  it('ignores a robot that fills the hidden field', async () => {
    const r = await post({ ...ok, website: 'http://spam' });
    expect(r.body).toEqual({ ok: true });
    expect(r.rows.length).toBe(0);
  });
  it('rejects a bad session id and bad json and long bodies', async () => {
    expect((await post({ ...ok, session: 'x' })).status).toBe(400);
    expect((await post('not json')).status).toBe(400);
    expect((await post({ ...ok, answers: { clear: 'y'.repeat(9000) } })).status).toBe(413);
  });
  it('keeps only whitelisted answer keys and clips long text', async () => {
    const r = await post({ ...ok, answers: { 'Bad Key!': 'x', confusing: 'z'.repeat(2000), clear: 99 } });
    const stored = JSON.parse(String(r.rows[0][4]));
    expect(Object.keys(stored)).toEqual(['confusing', 'clear']);
    expect(stored.confusing.length).toBe(1000);
    expect(stored.clear).toBe(10);
  });
  it('allows at most 5 submissions per session per hour', async () => {
    expect((await post(ok, 5)).status).toBe(429);
  });
});
