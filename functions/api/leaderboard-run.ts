// GET /api/leaderboard-run?id=<row id>: the keys of one published run, so a board row can be watched and raced (CC-108).
// Only a published, verified run is given out; the browser plays the keys with the simulator and takes the time from there.
import { json } from '../_lib/http';

interface Stmt { bind(...v: unknown[]): { first<T>(): Promise<T | null> } }
interface Env { DB: { prepare(sql: string): Stmt } }

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id) || id < 1) return json({ error: 'bad id' }, 400);
  try {
    const r = await env.DB.prepare('SELECT nick, ticks, keys, course_key AS course, course_hash AS hash FROM course_clears WHERE id = ? AND verified = 1 AND published = 1 AND keys IS NOT NULL').bind(id).first<{ nick: string; ticks: number; keys: string; course: string; hash: string }>();
    return r ? json(r) : json({ error: 'not found' }, 404);
  } catch { return json({ error: 'not found' }, 404); }
};
