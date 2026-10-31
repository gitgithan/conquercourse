// POST /api/share: store a run and answer with a short id (CC-219). The logic is in src/share/server.ts; this file is only the D1 side.
import type { CourseData } from '../../src/course/course';
import { createShare, type ShareEnv, type ShareRow, type ShareStore } from '../../src/share/server';
import { json as baseJson } from '../_lib/http';

interface Stmt { bind(...v: unknown[]): { run(): Promise<unknown>; first<T>(): Promise<T | null> } }
export interface Env { DB: { prepare(sql: string): Stmt }; ASSETS: { fetch(url: string): Promise<Response> }; SHARE?: string }

const COLS = ['id', 'created_at', 'sim_version', 'kind', 'course_kind', 'course_key', 'course_hash', 'query', 'made', 'nick', 'look', 'ticks', 'keys', 'content_hash', 'beats_ideal', 'status'] as const;

export function d1Store(db: Env['DB']): ShareStore {
  return {
    byContentHash: async (h) => (await db.prepare('SELECT id FROM shares WHERE content_hash = ? AND status = \'ok\'').bind(h).first<{ id: string }>())?.id ?? null,
    insert: async (r: ShareRow) => {
      try { await db.prepare(`INSERT INTO shares (${COLS.join(', ')}) VALUES (${COLS.map(() => '?').join(', ')})`).bind(...COLS.map((c) => r[c])).run(); return true; }
      catch (e) { if (/UNIQUE|constraint/i.test(String(e)) && !/content_hash/.test(String(e))) return false; throw e; }
    },
    get: (id) => db.prepare('SELECT * FROM shares WHERE id = ?').bind(id).first<ShareRow>(),
    countSince: async (t) => (await db.prepare('SELECT COUNT(*) AS n FROM shares WHERE created_at > ?').bind(t).first<{ n: number }>())?.n ?? 0,
    oldestSince: async (t) => (await db.prepare('SELECT MIN(created_at) AS t FROM shares WHERE created_at > ?').bind(t).first<{ t: number | null }>())?.t ?? null,
  };
}

const hits = new Map<string, number[]>();
export const shareEnv = (env: Env, request: Request): ShareEnv => ({
  store: d1Store(env.DB),
  hits, now: () => Date.now(), address: request.headers.get('cf-connecting-ip') ?? 'local',
  randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
  loadCourse: async (key) => {
    try { const r = await env.ASSETS.fetch(new URL(`/assets/${key}.course.json`, request.url).toString()); return r.ok ? await r.json() as CourseData : null; } catch { return null; }
  },
  idealTicks: async (key) => {
    try {
      const r = await env.ASSETS.fetch(new URL('/assets/course-meta.json', request.url).toString());
      const t = r.ok ? ((await r.json()) as Record<string, { idealTicks?: number | null }>)[key]?.idealTicks : null;
      return typeof t === 'number' ? t : null;
    } catch { return null; }
  },
});

export const json = (body: unknown, status = 200, extra: Record<string, string> = {}) => baseJson(body, status, { 'cache-control': 'no-store', ...extra });

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  if (env.SHARE === 'off') return json({ error: 'off' }, 503);
  try {
    const r = await createShare(shareEnv(env, request), await request.text());
    return json(r.body, r.status, r.headers);
  } catch (e) {
    // most likely the table does not exist yet (migration 0006 not applied): the game then sends the long link
    return json({ error: 'unavailable' }, 503);
  }
};
