// GET /api/leaderboard?course=demo/<name>: the fastest verified runs on a course, as three-letter tags and simulator times (CC-108).
// Only runs the server played again with the simulator are here (verified = 1), and only on the course as it is today (same hash).
// No player id is stored or shown. See docs/challenge.md, Part 4.
import { KEY } from './course-clear';
import { json } from '../_lib/http';

interface Stmt { bind(...v: unknown[]): { all(): Promise<{ results: unknown[] }> } }
interface Env { DB: { prepare(sql: string): Stmt } }

export interface Row { nick: string; ticks: number; ts: string }
export const TOP = 10;

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  const q = new URL(request.url).searchParams;
  const key = q.get('course') ?? '', hash = q.get('hash') ?? '';
  if (!KEY.test(key) || !/^[a-z0-9]{1,8}$/.test(hash)) return json({ error: 'bad course' }, 400);
  try {
    const r = await env.DB.prepare('SELECT nick, ticks, ts FROM course_clears WHERE course_key = ? AND course_hash = ? AND verified = 1 ORDER BY ticks ASC, id ASC LIMIT ?').bind(key, hash, TOP).all();
    return json({ course: key, top: r.results as Row[] });
  } catch { return json({ top: [] }); } // the columns are not there yet: an empty board, not an error
};
