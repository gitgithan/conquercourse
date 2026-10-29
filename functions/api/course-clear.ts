// POST /api/course-clear: a cleared run counts only after the server plays its keys with the simulator and gets a clear (CC-149).
// The time stored is the simulator's, never the one the browser says. No player id is stored with it.
import type { CourseData } from '../../src/course/course';
import { courseHash, decodeLog, MAX_REPLAY_TICKS, verifyLog } from '../../src/sim/replay';

interface Stmt { bind(...v: unknown[]): { run(): Promise<unknown>; first<T>(): Promise<T | null> } }
interface Env { DB: { prepare(sql: string): Stmt }; ASSETS: { fetch(url: string): Promise<Response> } }

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const ID = /^[a-zA-Z0-9-]{8,64}$/;
/** Only the listed courses count: the demo courses and the real places, named the way the course page names them. */
export const KEY = /^(demo|experiments\/osm)\/[a-z0-9-]{1,60}$/;
export const MAX_BODY = 8000;
const MAX_CLEAR_TICKS = Math.min(MAX_REPLAY_TICKS, 120 * 120); // two minutes; the replay costs the server about 11 ms for a 27 s run

function fnv(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ error: 'too long' }, 413);
  let b: Record<string, unknown>;
  try { b = JSON.parse(raw); } catch { return json({ error: 'bad json' }, 400); }
  const session = String(b.session ?? ''), runId = String(b.runId ?? ''), key = String(b.courseKey ?? ''), hash = String(b.hash ?? ''), keys = String(b.keys ?? '');
  if (!ID.test(session) || !ID.test(runId) || !KEY.test(key) || !/^[a-z0-9]{1,8}$/.test(hash) || !keys) return json({ error: 'bad run' }, 400);
  // the same slow-down as the start and fail events: one browser cannot send a flood
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM course_events WHERE session = ? AND ts > datetime('now', '-1 hour')").bind(session).first<{ n: number }>();
  if ((recent?.n ?? 0) >= 500) return json({ error: 'slow down' }, 429);
  const res = await env.ASSETS.fetch(new URL(`/assets/${key}.course.json`, request.url).toString());
  if (!res.ok) return json({ error: 'no such course' }, 404);
  const course = await res.json() as CourseData;
  if (courseHash(course) !== hash) return json({ error: 'course changed' }, 409);
  let log;
  try { log = await decodeLog(keys); } catch { return json({ error: 'bad keys' }, 400); }
  const v = verifyLog(course, log, MAX_CLEAR_TICKS);
  if (!v.cleared) return json({ error: 'not a clear' }, 422);
  // INSERT OR IGNORE: the same run, or the same keys sent twice, count once
  await env.DB.prepare("INSERT OR IGNORE INTO course_clears (ts, course_key, course_hash, ticks, run_id, log_hash) VALUES (datetime('now'), ?, ?, ?, ?, ?)")
    .bind(key, hash, v.ticks, runId, fnv(keys)).run();
  return json({ ok: true, ticks: v.ticks });
};
