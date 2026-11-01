import { afterEach, describe, expect, it, vi } from 'vitest';
import { localD1 } from './helpers-d1';
import { featureOn, offWords, recordUsage, CATEGORIES, PRICE_CENTS } from '../functions/_lib/usage';
import { accessOk, capsOf, report, route, sameSecret } from '../functions/api/admin-usage';
import { onRequestPost as liftPost, handle as lift } from '../functions/api/object-lift';
import { onRequestPost as segmentPost } from '../functions/api/segment';
import { onRequestPost as characterPost } from '../functions/api/character';
import { onRequestPost as agentPost } from '../functions/api/course-agent';
import { onRequestPost as tipsPost } from '../functions/api/move-tips';
import { onRequestPost as moderatePost } from '../functions/api/moderate';
import { onRequestPost as itemsPost } from '../functions/api/community-items';
import { onRequestPost as challengePost } from '../functions/api/challenge-course';
import { DEFAULT_LIMITS, memoryLedger, utcDay } from '../src/slice/upload-gates';

afterEach(() => vi.unstubAllGlobals());

const JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
const MODAL = { CC_UPLOAD_TOKEN: 't', CC_UPLOAD_SUBMIT_URL: 'https://a--b.modal.run', CC_UPLOAD_STATUS_URL: 'https://a--c.modal.run', CC_SEGMENT_SUBMIT_URL: 'https://a--s.modal.run', CC_SEGMENT_STATUS_URL: 'https://a--t.modal.run', CC_CHAR_TOKEN: 't', CC_CHAR_SUBMIT_URL: 'https://a--b.modal.run', CC_CHAR_STATUS_URL: 'https://a--c.modal.run' };
const liftBody = { action: 'submit', image: JPG, thumb: JPG, label: 'bench', box: [10, 10, 200, 200], width: 400, height: 400 };
const post = (body: unknown, ip = 'ip-1') => new Request('https://x/api', { method: 'POST', headers: { 'cf-connecting-ip': ip }, body: JSON.stringify(body) });
const modelReply = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
const flagOff = (sql: { exec(q: string): void }, name: string) => sql.exec(`INSERT OR REPLACE INTO flags (name, on_) VALUES ('${name}', 0)`);
const usage = (sql: unknown, c: string) => (sql as { prepare(q: string): { get(...a: unknown[]): { calls: number; created: number; est_cents: number } | undefined } }).prepare('SELECT calls, created, est_cents FROM usage_events WHERE category = ?').get(c);

// every paid route, one way to call it for real (the upstream is a counting fake)
type Call = (env: Record<string, unknown>) => Promise<Response>;
const ROUTES: Record<string, Call> = {
  photo3d: (env) => liftPost({ request: post(liftBody), env } as never),
  segment: (env) => segmentPost({ request: post({ action: 'submit', image: JPG, thumb: JPG }), env } as never),
  character: (env) => characterPost({ request: post({ action: 'create', prompt: `a calm owl ${Math.random().toString(36).slice(2, 8)}` }), env } as never),
  agent: (env) => agentPost({ request: post({ messages: [{ role: 'user', content: 'hi' }] }), env } as never),
  tips: (env) => tipsPost({ request: post({ name: 'bench' }), env } as never),
  moderation: (env) => moderatePost({ request: post({ text: 'a bench' }), env } as never),
  community_share: (env) => itemsPost({ request: post({ action: 'publish', session: 'player-aaaa-1111', kind: 'piece', name: 'railing', thumb: JPG, glb: btoa('glTF-fake'), height_m: 1 }), env } as never),
};
function upstream() {
  const n = { calls: 0 };
  vi.stubGlobal('fetch', async (url: string) => {
    n.calls++;
    return String(url).includes('modal.run') ? new Response(JSON.stringify({ id: `fc-JOB${String(n.calls).padStart(10, '0')}` }), { status: 200 }) : modelReply('{"verdict":"ok","reason":"none"}');
  });
  return n;
}
const envOf = (db: unknown) => ({ DB: db, BASETEN_API_KEY: 'k', ...MODAL });

describe('every paid route has a switch (503 when off, counted once when on)', () => {
  for (const c of Object.keys(ROUTES)) {
    it(`${c}: off answers 503 in plain words and calls nothing`, async () => {
      const { db, sql } = localD1(); const n = upstream(); flagOff(sql as never, c);
      const r = await ROUTES[c](envOf(db));
      expect(r.status).toBe(503);
      expect(JSON.stringify(await r.json())).toContain(offWords(c as never).slice(0, 12));
      expect(n.calls).toBe(0);
    });
    it(`${c}: on counts one call`, async () => {
      const { db, sql } = localD1(); upstream();
      const r = await ROUTES[c](envOf(db));
      expect(r.status, c).toBe(200);
      const u = usage(sql as never, c)!;
      expect(u.calls).toBe(1);
      expect(u.est_cents).toBe(PRICE_CENTS[c as never]);
      if (c === 'community_share') expect(u.created).toBe(1);
    });
  }
  it('challenge register: off answers 503 (it shares the community switch)', async () => {
    const { db, sql } = localD1(); flagOff(sql as never, 'community_share');
    expect((await challengePost({ request: post({}), env: { DB: db } } as never)).status).toBe(503);
  });
  it('a job status check still works with the photo switch off (jobs already running finish)', async () => {
    const { db, sql } = localD1(); upstream(); flagOff(sql as never, 'photo3d');
    expect((await liftPost({ request: post({ action: 'status', id: 'fc-ABCDEFGHIJK' }), env: envOf(db) } as never)).status).toBe(200);
  });
});

describe('the switch and the counter never hurt a request', () => {
  it('fails closed: no database, no table, a broken read all mean off', async () => {
    expect(await featureOn(undefined, 'agent')).toBe(false);
    const { db, sql } = localD1(); (sql as never as { exec(q: string): void }).exec('DROP TABLE flags');
    expect(await featureOn(db as never, 'agent')).toBe(false);
    expect((await ROUTES.agent(envOf(db))).status).toBe(503);
    const broken = { prepare: () => { throw new Error('D1 down'); } };
    expect(await featureOn(broken as never, 'agent')).toBe(false);
  });
  it('a missing row is on, a row with 0 is off', async () => {
    const { db, sql } = localD1();
    expect(await featureOn(db as never, 'tips')).toBe(true);
    flagOff(sql as never, 'tips');
    expect(await featureOn(db as never, 'tips')).toBe(false);
  });
  it('a failing usage write does not break the request', async () => {
    const { db } = localD1(); upstream();
    const flaky = { prepare: (q: string) => (q.includes('usage_events') ? { bind: () => ({ run: async () => { throw new Error('D1 down'); }, first: async () => null }) } : db.prepare(q)) };
    expect(await recordUsage(flaky as never, 'agent')).toBe(false);
    expect((await ROUTES.agent(envOf(flaky))).status).toBe(200);
  });
  it('a hanging usage write does not hold the request', async () => {
    const hang = { prepare: () => ({ bind: () => ({ run: () => new Promise(() => {}), first: async () => null }) }) };
    expect(await recordUsage(hang as never, 'agent')).toBe(false);
  }, 6000);
});

describe('many players, one paid upstream (simulation)', () => {
  it('500 players over 50 addresses never push the upstream past the game cap; midnight resets; a dead switch table stops everything', async () => {
    const ledger = memoryLedger(), limits = DEFAULT_LIMITS;
    let upstreamCalls = 0;
    const fetcher = (async () => { upstreamCalls++; return new Response(JSON.stringify({ id: `fc-SIM${String(upstreamCalls).padStart(10, '0')}` }), { status: 200 }); }) as unknown as typeof fetch;
    const env = { CC_UPLOAD_TOKEN: 't', CC_UPLOAD_SUBMIT_URL: MODAL.CC_UPLOAD_SUBMIT_URL, CC_UPLOAD_STATUS_URL: MODAL.CC_UPLOAD_STATUS_URL };
    const day1 = Date.UTC(2026, 10, 1, 9, 0, 0);
    const round = async (now: number) => {
      for (let p = 0; p < 500; p++) for (let k = 0; k < 2; k++) await lift(liftBody, env, `10.0.0.${p % 50}`, fetcher, 100000, ledger, limits, now);
    };
    await round(day1);
    expect(upstreamCalls).toBeLessThanOrEqual(limits.perGame);
    expect(upstreamCalls).toBe(limits.perGame); // the cap was reached, not exceeded
    await round(day1 + 3 * 3_600_000);
    expect(upstreamCalls).toBe(limits.perGame); // later the same day: nothing more
    const midnight = Date.UTC(2026, 10, 2, 0, 0, 1);
    expect(utcDay(midnight)).not.toBe(utcDay(day1));
    await round(midnight);
    expect(upstreamCalls).toBe(limits.perGame * 2); // a new day, a new allowance, still capped
    // fail closed: the switch table cannot be read -> the real route answers 503 and the upstream is not touched
    const { db, sql } = localD1(); (sql as never as { exec(q: string): void }).exec('DROP TABLE flags');
    const before = upstreamCalls; vi.stubGlobal('fetch', fetcher);
    for (let p = 0; p < 50; p++) expect((await liftPost({ request: post(liftBody, `10.0.1.${p}`), env: { DB: db, ...env } } as never)).status).toBe(503);
    expect(upstreamCalls).toBe(before);
  });
});

describe('/api/admin-usage', () => {
  const get = (env: Record<string, unknown>, headers: Record<string, string> = {}, method = 'GET', body?: unknown, fetcher?: typeof fetch) =>
    route(new Request('https://x/api/admin-usage', { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), env as never, fetcher);
  const TOKEN = 'a-long-test-token-0123456789';

  it('is a plain 404 when no way in is set up, for GET and POST', async () => {
    const { db } = localD1();
    for (const m of ['GET', 'POST']) { const r = await get({ DB: db }, { 'x-admin-token': TOKEN }, m, m === 'POST' ? { flag: 'agent', on: false } : undefined); expect(r.status).toBe(404); }
  });
  it('401 for a missing or wrong token, never a hint of the right one', async () => {
    const { db } = localD1();
    expect((await get({ DB: db, ADMIN_TOKEN: TOKEN })).status).toBe(401);
    const r = await get({ DB: db, ADMIN_TOKEN: TOKEN }, { 'x-admin-token': TOKEN + 'x' });
    expect(r.status).toBe(401); expect(await r.text()).not.toContain(TOKEN);
  });
  it('shows 14 days with every category, caps, flags and no-store headers', async () => {
    const { db } = localD1(); upstream();
    await ROUTES.agent(envOf(db));
    const r = await get({ DB: db, ADMIN_TOKEN: TOKEN }, { 'x-admin-token': TOKEN });
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(r.headers.get('x-robots-tag')).toContain('noindex');
    expect(r.headers.get('access-control-allow-origin')).toBeNull();
    const b = await r.json() as { days: { day: string; categories: { category: string; calls: number; cap: number | null; flag: boolean }[] }[]; flags: { name: string; on: boolean }[] };
    expect(b.days).toHaveLength(14);
    expect(b.days[0].day).toBe(utcDay(Date.now()));
    expect(b.days[0].categories.map((c) => c.category)).toEqual([...CATEGORIES]);
    expect(b.days[0].categories.find((c) => c.category === 'agent')!.calls).toBe(1);
    expect(b.days[0].categories.find((c) => c.category === 'photo3d')!.cap).toBe(DEFAULT_LIMITS.perGame);
    expect(b.flags).toHaveLength(CATEGORIES.length);
  });
  it('POST flips a flag, and the paid route obeys at once', async () => {
    const { db } = localD1(); upstream();
    const env = { DB: db, ADMIN_TOKEN: TOKEN };
    const h = { 'x-admin-token': TOKEN };
    const off = await get(env, h, 'POST', { flag: 'agent', on: false });
    expect(off.status).toBe(200); expect(off.headers.get('cache-control')).toBe('no-store');
    expect((await ROUTES.agent(envOf(db))).status).toBe(503);
    expect(((await (await get(env, h)).json()) as { flags: { name: string; on: boolean }[] }).flags.find((f) => f.name === 'agent')!.on).toBe(false);
    await get(env, h, 'POST', { flag: 'agent', on: true });
    expect((await ROUTES.agent(envOf(db))).status).toBe(200);
  });
  it('POST refuses an unknown flag or a wrong token, and changes nothing', async () => {
    const { db } = localD1(); const env = { DB: db, ADMIN_TOKEN: TOKEN };
    expect((await get(env, { 'x-admin-token': TOKEN }, 'POST', { flag: 'nope', on: false })).status).toBe(400);
    expect((await get(env, { 'x-admin-token': 'bad' }, 'POST', { flag: 'agent', on: false })).status).toBe(401);
    expect(await featureOn(db as never, 'agent')).toBe(true);
  });
  it('compares secrets without caring about length or position', async () => {
    expect(await sameSecret('abc', 'abc')).toBe(true);
    expect(await sameSecret('abc', 'abd')).toBe(false);
    expect(await sameSecret('abc', 'abcd')).toBe(false);
  });
  it('caps come from the environment; a category with none has none', () => {
    expect(capsOf({ ADMIN_CAPS: '{"agent":50}' }).agent).toBe(50);
    expect(capsOf({}).agent).toBeUndefined();
    expect(capsOf({ ADMIN_CAPS: 'junk' }).photo3d).toBe(DEFAULT_LIMITS.perGame);
  });
  it('report works on the real tables', async () => {
    const { db } = localD1();
    await recordUsage(db as never, 'tips', { now: Date.parse('2026-11-01T10:00:00Z') });
    const r = await report(db as never, {}, Date.parse('2026-11-01T12:00:00Z'));
    expect(r.days[0].categories.find((c) => c.category === 'tips')!.calls).toBe(1);
  });

  describe('the Cloudflare Access way in', () => {
    const env0 = { ACCESS_AUD: 'aud-1', ACCESS_TEAM: 'myteam' };
    const u = (o: object) => btoa(JSON.stringify(o)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    async function mint(claims: object, kid = 'k1') {
      const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
      const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
      const data = `${u({ alg: 'RS256', kid })}.${u(claims)}`;
      const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(data)));
      const jwt = `${data}.${btoa(String.fromCharCode(...sig)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}`;
      const fetcher = (async () => new Response(JSON.stringify({ keys: [{ kid, kty: 'RSA', n: jwk.n, e: jwk.e }] }), { status: 200 })) as unknown as typeof fetch;
      return { jwt, fetcher };
    }
    const good = { aud: ['aud-1'], iss: 'https://myteam.cloudflareaccess.com', exp: Math.floor(Date.now() / 1000) + 600 };
    it('accepts a correctly signed token for our audience', async () => {
      const { jwt, fetcher } = await mint(good);
      expect(await accessOk(jwt, env0, fetcher)).toBe(true);
      const { db } = localD1();
      expect((await get({ DB: db, ...env0 }, { 'cf-access-jwt-assertion': jwt }, 'GET', undefined, fetcher)).status).toBe(200);
    });
    it('refuses wrong audience, expired, tampered, other key, and junk', async () => {
      const a = await mint({ ...good, aud: ['other'] }); expect(await accessOk(a.jwt, env0, a.fetcher)).toBe(false);
      const e = await mint({ ...good, exp: 1 }); expect(await accessOk(e.jwt, env0, e.fetcher)).toBe(false);
      const t = await mint(good); const [h, , s] = t.jwt.split('.');
      expect(await accessOk(`${h}.${u({ ...good, aud: ['aud-1'], x: 1 })}.${s}`, env0, t.fetcher)).toBe(false);
      const o = await mint(good); expect(await accessOk(t.jwt, env0, o.fetcher)).toBe(false);
      expect(await accessOk('not.a.jwt', env0, t.fetcher)).toBe(false);
      expect(await accessOk(t.jwt, {}, t.fetcher)).toBe(false);
      expect(await accessOk(t.jwt, env0, (async () => { throw new Error('offline'); }) as never)).toBe(false);
    });
    it('a present header with no AUD configured gives no way in (404 without a token)', async () => {
      const { db } = localD1();
      expect((await get({ DB: db }, { 'cf-access-jwt-assertion': 'x.y.z' })).status).toBe(404);
    });
  });
});
