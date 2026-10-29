// POST /api/course-clear: a cleared run counts only after the server plays its keys with the simulator and gets a clear (CC-149).
// CC-174: cheap checks run first (src/sim/run-checks.ts); a clear whose replay is cut or skipped is kept as 'unverified' and never sets a best time. See docs/run-checks.md.
// The time stored is the simulator's, never the one the browser says. No player id is stored with it.
import type { CourseData } from '../../src/course/course';
import { courseHash, decodeLog, verifyLog } from '../../src/sim/replay';
import { beatsIdeal, checkRun, MAX_CLEAR_TICKS, physicsFloorTicks, rateLimited } from '../../src/sim/run-checks';

interface Stmt { bind(...v: unknown[]): { run(): Promise<unknown>; first<T>(): Promise<T | null> } }
interface Env { DB: { prepare(sql: string): Stmt }; ASSETS: { fetch(url: string): Promise<Response> }; REPLAY?: string }

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const ID = /^[a-zA-Z0-9-]{8,64}$/;
/** Only the listed courses count: the demo courses and the real places, named the way the course page names them. */
export const KEY = /^(demo|experiments\/osm)\/[a-z0-9-]{1,60}$/;
export const MAX_BODY = 8000;

function fnv(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}

const hits = new Map<string, number[]>();
// Does the table have the CC-174 columns (migration 0004)? Asked once per database; without them the endpoint works as before and an unverified clear is not kept.
const columns = new WeakMap<object, Promise<boolean>>();
function hasColumns(db: Env['DB']): Promise<boolean> {
  let p = columns.get(db);
  if (!p) { p = db.prepare('SELECT verified FROM course_clears LIMIT 1').bind().first().then(() => true, () => false); columns.set(db, p); }
  return p;
}
async function idealTicksOf(env: Env, url: string, key: string): Promise<number | null> {
  try {
    const res = await env.ASSETS.fetch(new URL('/assets/course-meta.json', url).toString());
    if (!res.ok) return null;
    const t = ((await res.json()) as Record<string, { idealTicks?: number | null }>)[key]?.idealTicks;
    return typeof t === 'number' ? t : null;
  } catch { return null; }
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ error: 'too long' }, 413);
  let b: Record<string, unknown>;
  try { b = JSON.parse(raw); } catch { return json({ error: 'bad json' }, 400); }
  const session = String(b.session ?? ''), runId = String(b.runId ?? ''), key = String(b.courseKey ?? ''), hash = String(b.hash ?? ''), keys = String(b.keys ?? '');
  const claimed = b.claimedTicks === undefined ? undefined : Number(b.claimedTicks);
  if (!ID.test(session) || !ID.test(runId) || !KEY.test(key) || !/^[a-z0-9]{1,8}$/.test(hash) || !keys) return json({ error: 'bad run' }, 400);
  if (claimed !== undefined && !Number.isInteger(claimed)) return json({ error: 'bad run' }, 400);
  // the same slow-down as the start and fail events: one browser cannot send a flood
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM course_events WHERE session = ? AND ts > datetime('now', '-1 hour')").bind(session).first<{ n: number }>();
  if ((recent?.n ?? 0) >= 500) return json({ error: 'slow down' }, 429);
  // and one address cannot make the server replay without end (it lives in one Worker's memory: it slows a flood, it does not stop one)
  if (rateLimited(hits, request.headers.get('cf-connecting-ip') ?? 'local', Date.now())) return json({ error: 'slow down' }, 429);
  const res = await env.ASSETS.fetch(new URL(`/assets/${key}.course.json`, request.url).toString());
  if (!res.ok) return json({ error: 'no such course' }, 404);
  const course = await res.json() as CourseData;
  if (courseHash(course) !== hash) return json({ error: 'course changed' }, 409);
  let log;
  try { log = await decodeLog(keys); } catch { return json({ error: 'bad keys' }, 400); }
  const fh = fnv(keys), cols = await hasColumns(env.DB);
  // a run already replayed and kept is not replayed again; one kept unverified gets another try
  const seen = await env.DB.prepare(`SELECT ${cols ? 'verified' : '1 AS verified'} FROM course_clears WHERE run_id = ? OR log_hash = ?`).bind(runId, fh).first<{ verified: number }>();
  if (seen?.verified === 1) return json({ ok: true, duplicate: true });
  // 1. cheap pre-filter: reject only what the physics or a person cannot do; flag (never reject) a run that beats the stored best line
  const pre = checkRun({ log, course, idealTicks: await idealTicksOf(env, request.url, key), claimedTicks: claimed });
  if (!pre.ok) return json({ error: 'not a possible run', code: pre.code }, 422);
  // 2. write the clear down as unverified BEFORE the replay: if Cloudflare cuts the Worker (Error 1102) nobody can catch it, and this row is what survives
  if (cols) {
    await env.DB.prepare("INSERT OR IGNORE INTO course_clears (ts, course_key, course_hash, ticks, run_id, log_hash, verified, beats_ideal) VALUES (datetime('now'), ?, ?, 0, ?, ?, 0, ?)")
      .bind(key, hash, runId, fh, pre.beatsIdeal ? 1 : 0).run();
  }
  // 3. the replay is the judge; skipped on purpose with REPLAY=off, and a throw counts as cut
  let v: ReturnType<typeof verifyLog> | null = null;
  if (env.REPLAY !== 'off') { try { v = verifyLog(course, log, MAX_CLEAR_TICKS); } catch { v = null; } }
  if (!v) return json({ ok: true, verified: false, stored: cols }, 202);
  if (!v.cleared || v.ticks < physicsFloorTicks(course)) {
    if (cols) await env.DB.prepare('DELETE FROM course_clears WHERE run_id = ? AND verified = 0').bind(runId).run();
    return json({ error: 'not a clear' }, 422);
  }
  const beats = beatsIdeal(v.ticks, await idealTicksOf(env, request.url, key));
  if (cols) {
    await env.DB.prepare('UPDATE course_clears SET ticks = ?, verified = 1, beats_ideal = ? WHERE run_id = ?').bind(v.ticks, beats ? 1 : 0, runId).run();
    // a run that beats the stored line keeps its keys, so the search can learn from it (migration 0005; without the column nothing happens)
    if (beats) { try { await env.DB.prepare('UPDATE course_clears SET keys = ? WHERE run_id = ?').bind(keys, runId).run(); } catch { /* no keys column yet */ } }
  } else {
    // INSERT OR IGNORE: the same run, or the same keys sent twice, count once
    await env.DB.prepare("INSERT OR IGNORE INTO course_clears (ts, course_key, course_hash, ticks, run_id, log_hash) VALUES (datetime('now'), ?, ?, ?, ?, ?)").bind(key, hash, v.ticks, runId, fh).run();
  }
  return json({ ok: true, verified: true, ticks: v.ticks, beatsIdeal: beats });
};
