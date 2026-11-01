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
  let players: number | undefined; // different players ever (not the sum of the daily counts, which would count a returning player again)
  try { players = Number(((await db.prepare('SELECT COUNT(DISTINCT session) AS n FROM course_events WHERE ts >= ?').bind(since).all()).results ?? [])[0]?.n) || 0; } catch { /* the tile falls back to the sum */ }
  return { days, series: { players: fill('players'), runs: fill('runs'), assets: fill('assets'), clears: fill('clears') }, players };
}

export const onRequestGet = async ({ env }: { env: Env }): Promise<Response> =>
  json(await dailyStats(env.DB), 200, { 'cache-control': 'public, max-age=300' });
