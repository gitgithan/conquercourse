// GET /api/course-stats: plays, verified clears, best verified time and the numbers behind the difficulty order, for every course (CC-149).
// Plays are run starts: a rough count, since one person can start many runs. No person is counted here.
interface Rows { results?: Record<string, unknown>[] }
interface Env { DB: { prepare(sql: string): { all(): Promise<Rows> } } }

export const MAX_CLEARS_READ = 3000;

export interface CourseNumbers { plays: number; fails: number; clears: number; best: number | null; median: number | null }

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

export const onRequestGet = async ({ env }: { env: Env }): Promise<Response> => {
  const out: Record<string, CourseNumbers> = {};
  const at = (k: string): CourseNumbers => (out[k] ??= { plays: 0, fails: 0, clears: 0, best: null, median: null });
  const events = await env.DB.prepare("SELECT course_key AS k, event_type AS e, COUNT(*) AS n FROM course_events WHERE event_type IN ('start','fail') GROUP BY course_key, event_type").all();
  for (const r of events.results ?? []) { const c = at(String(r.k)); if (r.e === 'start') c.plays = Number(r.n); else c.fails = Number(r.n); }
  // only clears of the newest version of a course count: a changed course makes an old time meaningless
  const clears = await env.DB.prepare(`SELECT c.course_key AS k, c.ticks AS t FROM course_clears c WHERE c.course_hash = (SELECT course_hash FROM course_clears d WHERE d.course_key = c.course_key ORDER BY d.id DESC LIMIT 1) ORDER BY c.id DESC LIMIT ${MAX_CLEARS_READ}`).all();
  const ticks: Record<string, number[]> = {};
  for (const r of clears.results ?? []) (ticks[String(r.k)] ??= []).push(Number(r.t));
  for (const [k, ts] of Object.entries(ticks)) { const c = at(k); c.clears = ts.length; c.best = Math.min(...ts); c.median = median(ts); }
  return new Response(JSON.stringify({ courses: out }), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' } });
};
