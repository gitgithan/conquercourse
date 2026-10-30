// GET /api/world-stats: how many people played in the last 24 hours, how many runs they made, and the busiest course (CC-108).
// A "person" here is a browser session id (a random code, no account); the count is rough on purpose. Cached for a minute.
import { json } from '../_lib/http';

interface Env { DB: { prepare(sql: string): { all(): Promise<{ results?: Record<string, unknown>[] }> } } }
export interface WorldStats { players: number; runs: number; clears: number; busiest: string | null; busiestRuns: number }

export const onRequestGet = async ({ env }: { env: Env }): Promise<Response> => {
  try {
    const t = await env.DB.prepare("SELECT COUNT(DISTINCT session) AS p, SUM(event_type = 'start') AS r, SUM(event_type = 'success') AS c FROM course_events WHERE ts > datetime('now', '-1 day')").all();
    const b = await env.DB.prepare("SELECT course_name AS n, COUNT(*) AS r FROM course_events WHERE event_type = 'start' AND ts > datetime('now', '-1 day') GROUP BY course_key ORDER BY r DESC LIMIT 1").all();
    const row = t.results?.[0] ?? {}, top = b.results?.[0];
    const out: WorldStats = { players: Number(row.p ?? 0), runs: Number(row.r ?? 0), clears: Number(row.c ?? 0), busiest: top ? String(top.n) : null, busiestRuns: top ? Number(top.r) : 0 };
    return json(out, 200, { 'cache-control': 'public, max-age=60' });
  } catch { return json({ players: 0, runs: 0, clears: 0, busiest: null, busiestRuns: 0 }); }
};
