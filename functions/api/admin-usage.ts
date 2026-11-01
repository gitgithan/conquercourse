// /api/admin-usage: the owner-only usage numbers and feature switches (CC-103, CC-118). Not linked from the site.
//   GET            -> {days:[{day, categories:[{category, calls, created, est_cents, cap, flag}]}], flags:[{name, label, on, note}]}  (last 14 days, newest first)
//   POST {flag, on} -> flips one switch; the paid routes read it on every request
// Who may call it (nobody else sees that it exists, the answer is 404):
//   - header x-admin-token equal to the Pages secret ADMIN_TOKEN (compared in constant time), or
//   - header Cf-Access-Jwt-Assertion, when ACCESS_AUD and ACCESS_TEAM are set: the token's signature is checked against the team's Cloudflare Access keys, and so are its audience and its dates.
// With neither way set up, every request is a plain 404. Replies are never stored, never indexed and carry no CORS header.
import { DEFAULT_LIMITS } from '../../src/slice/upload-gates';
import { CATEGORIES, LABELS, PRICE_CENTS, isCategory, utcDay, type Category } from '../_lib/usage';

interface Stmt { bind(...v: unknown[]): { run(): Promise<unknown>; all<T>(): Promise<{ results: T[] }> }; all<T>(): Promise<{ results: T[] }> }
export interface AdminDb { prepare(sql: string): Stmt }
export interface Env { DB?: AdminDb; ADMIN_TOKEN?: string; ACCESS_AUD?: string; ACCESS_TEAM?: string; ADMIN_CAPS?: string; CC_CHAR_LIMITS?: string }
export const DAYS = 14;

const HEAD = { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' };
const reply = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: HEAD });
const notFound = (): Response => new Response('not found', { status: 404, headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' } });

const enc = new TextEncoder();
/** Equal strings, in time that does not depend on where they differ (both are hashed first, so the length does not leak either). */
export async function sameSecret(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([a, b].map(async (s) => new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))));
  let d = a.length === b.length ? 0 : 1;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

const b64url = (s: string): Uint8Array<ArrayBuffer> => { const t = s.replace(/-/g, '+').replace(/_/g, '/'), bin = atob(t + '='.repeat((4 - (t.length % 4)) % 4)); return Uint8Array.from(bin, (c) => c.charCodeAt(0)); };
interface Jwk { kid: string; kty: string; n: string; e: string; alg?: string }

/** A Cloudflare Access token: RS256 signature against the team's published keys, the audience, the issuer and the dates. */
export async function accessOk(jwt: string, env: Env, fetcher: typeof fetch = fetch, now = Date.now()): Promise<boolean> {
  try {
    if (!env.ACCESS_AUD || !env.ACCESS_TEAM || !/^[a-z0-9-]{1,63}$/i.test(env.ACCESS_TEAM)) return false;
    const [h, p, s, extra] = jwt.split('.');
    if (!h || !p || !s || extra !== undefined) return false;
    const head = JSON.parse(new TextDecoder().decode(b64url(h))) as { alg?: string; kid?: string };
    if (head.alg !== 'RS256' || !head.kid) return false;
    const issuer = `https://${env.ACCESS_TEAM}.cloudflareaccess.com`;
    const res = await fetcher(`${issuer}/cdn-cgi/access/certs`);
    if (!res.ok) return false;
    const jwk = ((await res.json()) as { keys?: Jwk[] }).keys?.find((k) => k.kid === head.kid && k.kty === 'RSA');
    if (!jwk) return false;
    const key = await crypto.subtle.importKey('jwk', { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    if (!(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(s), enc.encode(`${h}.${p}`)))) return false;
    const c = JSON.parse(new TextDecoder().decode(b64url(p))) as { aud?: string | string[]; iss?: string; exp?: number; nbf?: number };
    const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
    const sec = Math.floor(now / 1000);
    return aud.includes(env.ACCESS_AUD) && c.iss === issuer && typeof c.exp === 'number' && c.exp > sec && (c.nbf === undefined || c.nbf <= sec + 60);
  } catch { return false; }
}

type Who = 'none' | 'denied' | 'ok';
async function who(request: Request, env: Env, fetcher: typeof fetch, now: number): Promise<Who> {
  const tokenSet = !!env.ADMIN_TOKEN, accessSet = !!(env.ACCESS_AUD && env.ACCESS_TEAM);
  if (!tokenSet && !accessSet) return 'none';
  const t = request.headers.get('x-admin-token');
  if (tokenSet && t && (await sameSecret(t, env.ADMIN_TOKEN!))) return 'ok';
  const jwt = request.headers.get('cf-access-jwt-assertion');
  if (accessSet && jwt && (await accessOk(jwt, env, fetcher, now))) return 'ok';
  return 'denied';
}

/** The daily number each row is judged against (red at 70%). It comes from the environment, never from this file; a category with none has no cap. */
export function capsOf(env: Env): Partial<Record<Category, number>> {
  const caps: Partial<Record<Category, number>> = { photo3d: DEFAULT_LIMITS.perGame };
  const m = /^(\d{1,4}),(\d{1,6})$/.exec(env.CC_CHAR_LIMITS ?? '');
  if (m) caps.character = Number(m[2]);
  try { for (const [k, v] of Object.entries(JSON.parse(env.ADMIN_CAPS ?? '{}') as Record<string, unknown>)) if (isCategory(k) && typeof v === 'number' && v > 0) caps[k] = v; } catch { /* no extra caps */ }
  return caps;
}

interface UsageRow { day: string; category: string; calls: number; created: number; est_cents: number }
interface FlagRow { name: string; on_: number; note: string | null; changed_at: number | null }

export async function report(db: AdminDb, env: Env, now = Date.now()) {
  const first = utcDay(now - (DAYS - 1) * 86_400_000);
  const rows = (await db.prepare('SELECT day, category, calls, created, est_cents FROM usage_events WHERE day >= ?').bind(first).all<UsageRow>()).results;
  const flagRows = (await db.prepare('SELECT name, on_, note, changed_at FROM flags').bind().all<FlagRow>()).results;
  const state = new Map(flagRows.map((f) => [f.name, f]));
  const on = (n: string) => (state.get(n) ? Number(state.get(n)!.on_) !== 0 : true);
  const caps = capsOf(env);
  const days = Array.from({ length: DAYS }, (_, i) => {
    const day = utcDay(now - i * 86_400_000);
    return { day, categories: CATEGORIES.map((category) => {
      const r = rows.find((x) => x.day === day && x.category === category);
      return { category, calls: r?.calls ?? 0, created: r?.created ?? 0, est_cents: Math.round((r?.est_cents ?? 0) * 100) / 100, cap: caps[category] ?? null, flag: on(category) };
    }) };
  });
  const flags = CATEGORIES.map((name) => ({ name, label: LABELS[name], on: on(name), note: state.get(name)?.note ?? null, price_cents_estimate: PRICE_CENTS[name] }));
  return { days, flags };
}

export async function setFlag(db: AdminDb, name: string, on: boolean, now = Date.now()): Promise<void> {
  await db.prepare('INSERT INTO flags (name, on_, note, changed_at) VALUES (?, ?, NULL, ?) ON CONFLICT (name) DO UPDATE SET on_ = excluded.on_, changed_at = excluded.changed_at').bind(name, on ? 1 : 0, Math.floor(now / 1000)).run();
}

/** Who made what, newest first (the last 200 of each): pieces and wallpapers shared to Community, and characters. "owner" is an anonymous code, never a name or an address. */
export async function made(db: AdminDb): Promise<{ items: Record<string, unknown>[]; characters: Record<string, unknown>[] }> {
  const get = async (sql: string): Promise<Record<string, unknown>[]> => { try { return (await db.prepare(sql).all<Record<string, unknown>>()).results; } catch { return []; } };
  const code = (r: Record<string, unknown>) => ({ ...r, owner: String(r.owner ?? '').slice(0, 8) });
  return {
    items: (await get('SELECT id, owner, kind, name, status, created_at AS at, moderation FROM community_items ORDER BY created_at DESC LIMIT 200')).map(code),
    characters: (await get('SELECT id, owner, name, prompt, provider, status, reports, picks, ts AS at FROM characters ORDER BY ts DESC LIMIT 200')).map(code),
  };
}

export async function route(request: Request, env: Env, fetcher: typeof fetch = fetch, now = Date.now()): Promise<Response> {
  const w = await who(request, env, fetcher, now);
  if (w === 'none') return notFound();
  if (w === 'denied') return reply({ error: 'not allowed' }, 401);
  if (!env.DB) return reply({ error: 'no database' }, 503);
  try {
    if (request.method === 'GET') return reply(new URL(request.url).searchParams.get('view') === 'made' ? await made(env.DB) : await report(env.DB, env, now));
    if (request.method === 'POST') {
      const raw = await request.text();
      if (raw.length > 500) return reply({ error: 'bad' }, 413);
      const b = JSON.parse(raw) as { flag?: unknown; on?: unknown };
      if (!isCategory(b.flag) || typeof b.on !== 'boolean') return reply({ error: 'bad' }, 400);
      await setFlag(env.DB, b.flag, b.on, now);
      return reply({ ok: true, flag: b.flag, on: b.on });
    }
    return reply({ error: 'GET or POST only' }, 405);
  } catch { return reply({ error: 'unavailable' }, 503); }
}

export const onRequest = ({ request, env }: { request: Request; env: Env }): Promise<Response> => route(request, env);
