// GET /api/course-stats: plays, verified clears, best verified time and the numbers behind the difficulty order, for every course (CC-149).
// Plays are run starts: a rough count, since one person can start many runs. No person is counted here.
interface Rows { results?: Record<string, unknown>[] }
interface Env { DB: { prepare(sql: string): { all(): Promise<Rows> } } }

export const MAX_CLEARS_READ = 3000;

export interface CourseNumbers { plays: number; fails: number; clears: number; best: number | null; median: number | null; today?: number } // today: run starts since 00:00 UTC

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
  // CC-108: plays today = run starts since 00:00 UTC; one grouped count per call, and the reply is cached, so the cost stays tiny; a failed query just leaves the part out
  try {
    const day = await env.DB.prepare("SELECT course_key AS k, COUNT(*) AS n FROM course_events WHERE event_type = 'start' AND ts >= date('now') GROUP BY course_key").all();
    for (const r of day.results ?? []) at(String(r.k)).today = Number(r.n);
  } catch { /* no today numbers: the cards show the all-time count only */ }
  // only clears of the newest version of a course count: a changed course makes an old time meaningless
  // CC-174: an unverified clear (replay cut or skipped) counts as cleared but never sets the best or the median; one that beats the stored best line waits for a replay and is not counted yet
  const newest = "c.course_hash = (SELECT course_hash FROM course_clears d WHERE d.course_key = c.course_key ORDER BY d.id DESC LIMIT 1)";
  let clears: Rows;
  try { clears = await env.DB.prepare(`SELECT c.course_key AS k, c.ticks AS t, c.verified AS v FROM course_clears c WHERE ${newest} AND (c.verified = 1 OR c.beats_ideal = 0) ORDER BY c.id DESC LIMIT ${MAX_CLEARS_READ}`).all(); }
  catch { clears = await env.DB.prepare(`SELECT c.course_key AS k, c.ticks AS t, 1 AS v FROM course_clears c WHERE ${newest} ORDER BY c.id DESC LIMIT ${MAX_CLEARS_READ}`).all(); } // before migration 0004
  const ticks: Record<string, number[]> = {}, counts: Record<string, number> = {};
  for (const r of clears.results ?? []) {
    const k = String(r.k);
    counts[k] = (counts[k] ?? 0) + 1;
    if (Number(r.v) === 1) (ticks[k] ??= []).push(Number(r.t));
  }
  for (const [k, n] of Object.entries(counts)) {
    const c = at(k), ts = ticks[k] ?? [];
    c.clears = n;
    if (ts.length) { c.best = Math.min(...ts); c.median = median(ts); }
  }
  return new Response(JSON.stringify({ courses: out }), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' } });
};
