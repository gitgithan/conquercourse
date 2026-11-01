// /api/community-items: finished pieces that players share in Community (CC-247). Storage: D1 table community_items (migrations/0014).
//   GET                          the approved items, newest first, without files: {items:[{id, kind, name, at, meta, thumb: "/api/community-items?id=..&file=thumb"}]}
//   GET with header x-cc-session the same plus this browser's own items (pending ones too), each with its small picture inline and mine:true
//   GET ?id=..&file=thumb|glb    one file; an approved item to anyone, any other only to its owner (header x-cc-session)
//   POST {action:"publish", session, kind, name, thumb, glb?, height_m?, course?}  -> {id, status: "approved"|"pending"}
//   POST {action:"delete", session, id}  -> {ok:true}; only the owner can delete, and the files are emptied
// Ownership is a one-way code of the browser's random session id (functions/_lib/player.ts), never an address. A stranger and a missing item get the same 404.
import { cleanItem, SESSION_RE, visibilityFor, type PublicItem } from '../../src/community/items';
import { moderationStops } from '../../src/slice/object-lift';
import { askModeration } from './moderate';
import { limited, waitSeconds } from './designer';
import { refusalBody } from '../../src/slice/stages';
import { playerCode } from '../_lib/player';
import { json } from '../_lib/http';
import { spendReceipt } from '../_lib/receipt';
import { featureOn, offWords, recordUsage } from '../_lib/usage';

interface Stmt { bind(...v: unknown[]): { run(): Promise<{ meta?: { changes?: number } }>; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }> } }
export interface Db { prepare(sql: string): Stmt }
interface Env { DB?: Db; BASETEN_API_KEY?: string; CC_UPLOAD_TOKEN?: string; REQUIRE_LIFT_RECEIPT?: string }
interface Row { id: string; kind: 'piece'; name: string; status: string; created_at: number; thumb: string; meta: string; owner?: string }

const OWNER_SALT = 'cc-item';
const LIVE_PER_OWNER = 12;
const BURST_PER_ADDRESS = 8;
const THUMB_URL = (id: string) => `/api/community-items?id=${id}&file=thumb`;
const newId = (): string => { const a = 'abcdefghjkmnpqrstuvwxyz23456789', r = crypto.getRandomValues(new Uint8Array(10)); return [...r].map((x) => a[x % a.length]).join(''); };
const own = (session: string | null) => (session && SESSION_RE.test(session) ? playerCode(session, OWNER_SALT) : Promise.resolve(''));
const shape = (r: Row, mine: boolean): PublicItem => ({ id: r.id, kind: r.kind, name: r.name, at: r.created_at, meta: JSON.parse(r.meta || '{}'), thumb: mine ? r.thumb : THUMB_URL(r.id), ...(mine ? { mine: true, status: r.status } : {}) });

export async function publish(b: Record<string, unknown>, env: Env, ip: string, fetcher: typeof fetch = fetch, now = Date.now()): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!env.DB) return { status: 503, body: { error: 'off', message: 'Sharing is switched off right now.' } };
  const session = String(b.session ?? '');
  if (!SESSION_RE.test(session)) return { status: 400, body: { error: 'bad', message: 'This browser has no player code yet. Reload the page.' } };
  const c = cleanItem(b);
  if (!c.ok) return { status: 400, body: { error: 'bad', message: c.error } };
  if (limited(`share:${ip}`, now, BURST_PER_ADDRESS)) return { status: 429, body: refusalBody('busy', 'You shared a lot just now. Wait a few minutes.', waitSeconds(`share:${ip}`, now)) };
  const owner = await own(session);
  const live = await env.DB.prepare("SELECT COUNT(*) AS n FROM community_items WHERE owner = ? AND status != 'removed'").bind(owner).first<{ n: number }>();
  if ((live?.n ?? 0) >= LIVE_PER_OWNER) return { status: 429, body: { error: 'full', message: 'You have shared as many as we keep for one player. Delete one to share another.' } };
  // the safety check looks at the small picture again here: the page's earlier check is not trusted
  let moderation = 'skipped:none', visible: 'approved' | 'pending' = 'pending';
  if (env.BASETEN_API_KEY) {
    const m = await askModeration(env.BASETEN_API_KEY, { image: c.item.thumb }, fetcher);
    const stop = moderationStops(m.body.verdict, m.body.reason);
    if (m.body.verdict === 'block' || (stop && m.body.verdict === 'review' && !['error', 'unreadable', 'person'].includes(m.body.reason))) return { status: 403, body: { error: 'moderation', message: stop || 'This picture cannot be shared here.' } };
    moderation = `${m.body.verdict}:${m.body.reason}`;
    const v = visibilityFor(m.body.verdict, m.body.reason);
    visible = v === 'approved' ? 'approved' : 'pending';
  }
  const spent = await spendReceipt(env as never, b.receipt, now);
  if (!spent.ok) return { status: 403, body: { error: 'receipt', message: spent.message } };
  const id = newId();
  await env.DB.prepare("INSERT INTO community_items (id, owner, kind, name, status, created_at, thumb, glb, meta, moderation) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(id, owner, c.item.kind, c.item.name, visible, Math.floor(now / 1000), c.item.thumb, c.item.glb, JSON.stringify(c.item.meta), moderation).run();
  return { status: 200, body: { id, status: visible } };
}

/** Delete one item. Only its owner can; everyone else, and a missing or already removed item, gets the same 404. The files are emptied, not just hidden. */
export async function remove(b: Record<string, unknown>, env: Env, now = Date.now()): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!env.DB) return { status: 503, body: { error: 'off' } };
  const id = String(b.id ?? '');
  if (!/^[a-z0-9]{10}$/.test(id)) return { status: 404, body: { error: 'not found' } };
  const owner = await own(String(b.session ?? ''));
  if (!owner) return { status: 404, body: { error: 'not found' } };
  const r = await env.DB.prepare("UPDATE community_items SET status = 'removed', removed_at = ?, thumb = '', glb = '', meta = '{}' WHERE id = ? AND owner = ? AND status != 'removed'").bind(Math.floor(now / 1000), id, owner).run();
  if ((r.meta?.changes ?? 0) < 1) return { status: 404, body: { error: 'not found' } };
  return { status: 200, body: { ok: true } };
}

export const PAGE = 24; // items in one page of the list
export interface ListQuery { q?: string; kind?: string; cursor?: string }
/** A cursor is the created_at and id of the last item of the page before: "1730000000.abcdefghij". */
const parseCursor = (c: string | undefined): { at: number; id: string } | null => { const m = /^(\d{1,12})\.([a-z0-9]{10})$/.exec(c ?? ''); return m ? { at: Number(m[1]), id: m[2] } : null; };
const likeOf = (q: string | undefined): string => `%${String(q ?? '').replace(/[^a-z0-9 '-]/gi, '').trim().slice(0, 40).replace(/[%_]/g, '')}%`;

export async function list(env: Env, session: string | null, opt: ListQuery = {}): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!env.DB) return { status: 200, body: { items: [], off: true } };
  const cur = parseCursor(opt.cursor), kind = 'piece'; // old wallpaper rows stay in the table but are never listed
  const word = likeOf(opt.q);
  // where-clause and values shared by both lists; the name is searched in SQL, so a page is only ever one page
  const where = (base: string, vals: unknown[]) => ({ sql: base + (kind ? ' AND kind = ?' : '') + (word !== '%%' ? ' AND name LIKE ?' : '') + (cur ? ' AND (created_at < ? OR (created_at = ? AND id < ?))' : ''), vals: [...vals, ...(kind ? [kind] : []), ...(word !== '%%' ? [word] : []), ...(cur ? [cur.at, cur.at, cur.id] : [])] });
  const pw = where("status = 'approved'", []);
  const pub = await env.DB.prepare(`SELECT id, kind, name, status, created_at, '' AS thumb, meta FROM community_items WHERE ${pw.sql} ORDER BY created_at DESC, id DESC LIMIT ${PAGE + 1}`).bind(...pw.vals).all<Row>();
  const more = pub.results.length > PAGE, rows = pub.results.slice(0, PAGE);
  const last = rows[rows.length - 1];
  const next = more && last ? `${last.created_at}.${last.id}` : null;
  const items = rows.map((r) => shape(r, false));
  const owner = await own(session);
  if (owner && !cur) { // your own come first, on the first page only
    const mw = where("owner = ? AND status != 'removed'", [owner]);
    const mine = await env.DB.prepare(`SELECT id, kind, name, status, created_at, thumb, meta FROM community_items WHERE ${mw.sql} ORDER BY created_at DESC, id DESC LIMIT ${PAGE}`).bind(...mw.vals).all<Row>();
    const ids = new Set(mine.results.map((r) => r.id));
    return { status: 200, body: { items: [...mine.results.map((r) => shape(r, true)), ...items.filter((i) => !ids.has(i.id))], next } };
  }
  return { status: 200, body: { items, next } };
}

export async function file(env: Env, id: string, which: string, session: string | null): Promise<Response> {
  if (!env.DB || !/^[a-z0-9]{10}$/.test(id) || (which !== 'thumb' && which !== 'glb')) return new Response('not found', { status: 404 });
  const row = await env.DB.prepare("SELECT status, owner, thumb, glb FROM community_items WHERE id = ? AND status != 'removed'").bind(id).first<{ status: string; owner: string; thumb: string; glb: string }>();
  if (!row) return new Response('not found', { status: 404 });
  if (row.status !== 'approved' && (!session || (await own(session)) !== row.owner)) return new Response('not found', { status: 404 });
  const b64 = which === 'thumb' ? row.thumb.replace(/^data:image\/jpeg;base64,/, '') : row.glb;
  if (!b64) return new Response('not found', { status: 404 });
  const bin = atob(b64), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Response(bytes, { headers: { 'content-type': which === 'thumb' ? 'image/jpeg' : 'model/gltf-binary', 'cache-control': row.status === 'approved' ? 'public, max-age=60' : 'private, no-store' } });
}

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  const q = new URL(request.url).searchParams, session = request.headers.get('x-cc-session');
  if (q.get('id')) return file(env, q.get('id') ?? '', q.get('file') ?? '', session);
  const r = await list(env, session, { q: q.get('q') ?? '', kind: q.get('kind') ?? '', cursor: q.get('cursor') ?? '' });
  return json(r.body, r.status, { 'cache-control': session ? 'private, no-store' : 'public, max-age=30' });
};

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  const raw = await request.text();
  if (raw.length > 1_700_000) return json({ error: 'bad', message: 'That is too big to share.' }, 413);
  let b: Record<string, unknown>;
  try { b = JSON.parse(raw); } catch { return json({ error: 'bad' }, 400); }
  const ip = request.headers.get('cf-connecting-ip') ?? 'local';
  if (b.action === 'publish' && !(await featureOn(env.DB, 'community_share'))) return json({ error: 'off', message: offWords('community_share') }, 503);
  const r = b.action === 'delete' ? await remove(b, env) : b.action === 'publish' ? await publish(b, env, ip) : { status: 400, body: { error: 'bad' } };
  if (b.action === 'publish' && r.status === 200) await recordUsage(env.DB, 'community_share', { created: 1 });
  const wait = (r.body as { retryAfterSeconds?: number }).retryAfterSeconds;
  return json(r.body, r.status, wait ? { 'retry-after': String(wait) } : {});
};
