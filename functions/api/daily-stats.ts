// GET /api/daily-stats: one count per UTC day for players, runs, assets made and courses cleared (CC-108), for the growth chart on the course picker.
//   players: different random browser codes that started a run that day (no accounts, no address)
//   runs: run starts; assets made: photo-to-3D objects plus community photos; clears: cleared runs the server replayed
// Every metric is its own query: one that fails (a table that is not there yet) leaves zeros, never the whole reply. Cached for five minutes.
import { json } from '../_lib/http';
import { MAX_DAYS, dayList, utcDay, zeroFill, type DailyStats, type Metric } from '../../src/slice/daily-stats';

type Rows = { results?: Record<string, unknown>[] };
interface Env { DB: { prepare(sql: string): { bind(...v: unknown[]): { all(): Promise<Rows> } } } }

/** One query per metric; ? is the first day to count. Nothing from the request is put in the text. */
export const QUERIES: Record<Metric, string[]> = {
  players: ['SELECT date(ts) AS d, COUNT(DISTINCT session) AS n FROM course_events WHERE ts >= ? GROUP BY date(ts)'],
  runs: ["SELECT date(ts) AS d, COUNT(*) AS n FROM course_events WHERE event_type = 'start' AND ts >= ? GROUP BY date(ts)"],
  assets: [
    "SELECT day AS d, n AS n FROM upload_days WHERE player = '*' AND day >= ?", // photo to 3D object slots taken that day
    'SELECT date(ts) AS d, COUNT(*) AS n FROM community WHERE ts >= ? GROUP BY date(ts)', // community photos
  ],
  clears: ['SELECT date(ts) AS d, COUNT(*) AS n FROM course_clears WHERE ts >= ? GROUP BY date(ts)'],
};

/** The same four numbers over all time: one count each. */
export const TOTALS: Record<Metric, string[]> = {
  players: ['SELECT COUNT(DISTINCT session) AS n FROM course_events'],
  runs: ["SELECT COUNT(*) AS n FROM course_events WHERE event_type = 'start'"],
  assets: ["SELECT COALESCE(SUM(n), 0) AS n FROM upload_days WHERE player = '*'", 'SELECT COUNT(*) AS n FROM community'],
  clears: ['SELECT COUNT(*) AS n FROM course_clears'],
};

export async function dailyStats(db: Env['DB'], now = Date.now()): Promise<DailyStats> {
  const to = utcDay(now), since = utcDay(now - (MAX_DAYS - 1) * 86_400_000);
  const rows: Record<Metric, Record<string, unknown>[]> = { players: [], runs: [], assets: [], clears: [] };
  for (const m of Object.keys(QUERIES) as Metric[]) {
    for (const sql of QUERIES[m]) {
      try { rows[m].push(...((await db.prepare(sql).bind(since).all()).results ?? []) as never[]); } catch { /* that part stays at zero */ }
    }
  }
  // the chart starts on the first day anything happened, so a young game is not a long flat line
  const firstDay = Object.values(rows).flat().map((r) => String(r.d)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()[0] ?? to;
  const days = dayList(firstDay, to);
  const fill = (m: Metric) => zeroFill(days, rows[m] as { d: unknown; n: unknown }[]);
  const totals = {} as Record<Metric, number>; // all time, with no start day, so the tiles never forget old days (players: different codes, not a sum of daily counts)
  for (const m of Object.keys(TOTALS) as Metric[]) {
    let sum = 0, ok = false;
    for (const sql of TOTALS[m]) { try { sum += Number((((await db.prepare(sql).bind().all()).results ?? [])[0]?.n)) || 0; ok = true; } catch { /* that part stays out */ } }
    if (ok) totals[m] = sum;
  }
  return { days, series: { players: fill('players'), runs: fill('runs'), assets: fill('assets'), clears: fill('clears') }, totals };
}

export const onRequestGet = async ({ env }: { env: Env }): Promise<Response> =>
  json(await dailyStats(env.DB), 200, { 'cache-control': 'public, max-age=300' });
