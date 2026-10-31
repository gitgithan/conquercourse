// GET /api/world-stats: the numbers for the strip on the course picker (CC-108). Cached for a minute.
//   last 24 hours: players (random browser codes, no accounts), runs, clears, and each course's runs and clears
//   all time: verified clears and countries (two-letter codes only, never an address); last 7 days: the newest record and the zone where most runs failed
// Every part is optional: a query that fails (a column from migration 0009 is not there yet) leaves its part out, never the whole reply.
import { json } from '../_lib/http';

type Rows = { results?: Record<string, unknown>[] };
interface Env { DB: { prepare(sql: string): { all(): Promise<Rows> } } }
export interface WorldStats {
  players: number; runs: number; clears: number; countries: number; totalClears: number;
  courses: Record<string, { runs: number; clears: number }>;
  busiest: string | null;
  record: { course: string; nick: string; ticks: number } | null;
  hardest: { course: string; zone: string; fails: number } | null;
}
export const EMPTY: WorldStats = { players: 0, runs: 0, clears: 0, countries: 0, totalClears: 0, courses: {}, busiest: null, record: null, hardest: null };

export const onRequestGet = async ({ env }: { env: Env }): Promise<Response> => {
  const q = async (sql: string): Promise<Record<string, unknown>[]> => { try { return (await env.DB.prepare(sql).all()).results ?? []; } catch { return []; } };
  const day = "ts > datetime('now', '-1 day')";
  const [tot] = await q(`SELECT COUNT(DISTINCT session) AS p, SUM(event_type = 'start') AS r, SUM(event_type = 'success') AS c FROM course_events WHERE ${day}`);
  const [cty] = await q(`SELECT COUNT(DISTINCT country) AS n FROM course_events WHERE country != ''`);
  const [all] = await q('SELECT COUNT(*) AS n FROM course_clears WHERE verified = 1');
  const per = await q(`SELECT course_key AS k, course_name AS name, SUM(event_type = 'start') AS r, SUM(event_type = 'success') AS c FROM course_events WHERE ${day} GROUP BY course_key`);
  const rec = await q("SELECT c.course_key AS k, c.nick AS nick, c.ticks AS t FROM course_clears c WHERE c.verified = 1 AND c.ts > datetime('now', '-7 days') AND c.ticks = (SELECT MIN(d.ticks) FROM course_clears d WHERE d.course_key = c.course_key AND d.course_hash = c.course_hash AND d.verified = 1) ORDER BY c.id DESC LIMIT 1");
  const hard = await q("SELECT course_name AS name, fail_at AS z, COUNT(*) AS n FROM course_events WHERE event_type = 'fail' AND fail_at NOT IN ('', 'gap') AND ts > datetime('now', '-7 days') GROUP BY course_key, fail_at ORDER BY n DESC LIMIT 1");
  const out: WorldStats = { ...EMPTY, courses: {}, players: Number(tot?.p ?? 0), runs: Number(tot?.r ?? 0), clears: Number(tot?.c ?? 0), countries: Number(cty?.n ?? 0), totalClears: Number(all?.n ?? 0) };
  let top = 0;
  for (const r of per) { const runs = Number(r.r ?? 0); out.courses[String(r.k)] = { runs, clears: Number(r.c ?? 0) }; if (runs > top) { top = runs; out.busiest = String(r.name); } }
  if (rec[0]) out.record = { course: String(rec[0].k).split('/').pop() ?? '', nick: String(rec[0].nick ?? ''), ticks: Number(rec[0].t) };
  if (hard[0] && Number(hard[0].n) >= 3) out.hardest = { course: String(hard[0].name), zone: String(hard[0].z), fails: Number(hard[0].n) }; // fewer than three is noise
  return json(out, 200, { 'cache-control': 'public, max-age=60' });
};
