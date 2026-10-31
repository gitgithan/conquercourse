// GET /api/leaderboard?course=demo/<name>&hash=<hash>&window=day|week|all&me=<session>: the fastest verified runs on a course (CC-108).
// Only a run the player published counts (migration 0012). One best time per player; windows are non-overlapping UTC days and weeks (src/share/windows.ts), so everyone resets at the same moment.
// Replies: the top hundred (each row has an id for View Run), how many players are on the board, your place (when `me` is sent), when it resets, and the last window's winner.
import { KEY } from './course-clear';
import { isWindow, nextReset, previousStart, sqlTime, windowStart, type Window } from '../../src/share/windows';
import { playerCode } from '../_lib/player';
import { json } from '../_lib/http';

interface Stmt { bind(...v: unknown[]): { all(): Promise<{ results: unknown[] }>; first<T>(): Promise<T | null> } }
interface Env { DB: { prepare(sql: string): Stmt } }

export interface Row { id?: number; nick: string; ticks: number }
export interface Board { course: string; window: Window; top: Row[]; players: number; mine: { rank: number; ticks: number } | null; resetAt: number | null; previous: Row | null }
export const TOP = 100;

// the player a row belongs to: the code, or the run for a row from before codes existed
const WHO = "COALESCE(NULLIF(player, ''), run_id)";
const BASE = 'FROM course_clears WHERE course_key = ? AND course_hash = ? AND verified = 1 AND published = 1 AND ts >= ? AND ts < ?';

export async function board(env: Env, key: string, hash: string, w: Window, now: number, me: string): Promise<Board> {
  const from = sqlTime(windowStart(w, now)), to = sqlTime(now + 1000);
  const top = (await env.DB.prepare(`SELECT id, nick, MIN(ticks) AS ticks ${BASE} GROUP BY ${WHO} ORDER BY ticks ASC, MIN(id) ASC LIMIT ?`).bind(key, hash, from, to, TOP).all()).results as Row[];
  const n = await env.DB.prepare(`SELECT COUNT(DISTINCT ${WHO}) AS n ${BASE}`).bind(key, hash, from, to).first<{ n: number }>();
  let mine: Board['mine'] = null;
  if (me) {
    const best = await env.DB.prepare(`SELECT MIN(ticks) AS t ${BASE} AND player = ?`).bind(key, hash, from, to, me).first<{ t: number | null }>();
    if (best?.t != null) {
      const faster = await env.DB.prepare(`SELECT COUNT(*) AS n FROM (SELECT ${WHO} AS w, MIN(ticks) AS t ${BASE} GROUP BY w) WHERE t < ?`).bind(key, hash, from, to, best.t).first<{ n: number }>();
      mine = { rank: (faster?.n ?? 0) + 1, ticks: best.t };
    }
  }
  let previous: Row | null = null;
  if (w !== 'all') {
    const p = (await env.DB.prepare(`SELECT nick, MIN(ticks) AS ticks ${BASE} GROUP BY ${WHO} ORDER BY ticks ASC, MIN(id) ASC LIMIT 1`).bind(key, hash, sqlTime(previousStart(w, now)), sqlTime(windowStart(w, now))).all()).results as Row[];
    previous = p[0] ?? null;
  }
  return { course: key, window: w, top, players: n?.n ?? 0, mine, resetAt: nextReset(w, now), previous };
}

/** The newest published run on any course: the line at the top of the Course page. */
export async function recent(env: Env): Promise<{ course: string; nick: string; ticks: number; ts: string } | null> {
  return env.DB.prepare('SELECT course_key AS course, nick, ticks, ts FROM course_clears WHERE verified = 1 AND published = 1 ORDER BY id DESC LIMIT 1').bind().first();
}

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  const q = new URL(request.url).searchParams;
  if (q.get('recent')) { try { return json({ run: await recent(env) }); } catch { return json({ run: null }); } }
  const key = q.get('course') ?? '', hash = q.get('hash') ?? '', w = q.get('window') ?? 'all', me = q.get('me') ?? '';
  if (!KEY.test(key) || !/^[a-z0-9]{1,8}$/.test(hash) || !isWindow(w)) return json({ error: 'bad course' }, 400);
  try {
    return json(await board(env, key, hash, w, Date.now(), /^[a-zA-Z0-9-]{8,64}$/.test(me) ? await playerCode(me, 'cc-board') : ''));
  } catch { return json({ course: key, window: w, top: [], players: 0, mine: null, resetAt: nextReset(w, Date.now()), previous: null } satisfies Board); } // the columns are not there yet
};
