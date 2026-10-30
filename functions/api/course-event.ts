import { json } from '../_lib/http';
// POST /api/course-event: one start, failure, or success event per course attempt.
interface Env { DB: { prepare(sql: string): { bind(...v: unknown[]): { run(): Promise<unknown>; first<T>(): Promise<T | null> } } } }

const clip = (v: unknown, n: number): string => String(v ?? '').slice(0, n);
// CC-211: only a stored course or a generated seed (both proved clearable) gets a log row; a made-up key or name is not saved.
export const PROVEN_KEY = /^((demo|experiments\/osm)\/[a-z0-9-]{1,60}|generated-\d{1,9})$/;
const events = new Set(['start', 'fail', 'success']);

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  const raw = await request.text();
  if (raw.length > 2000) return json({ error: 'too long' }, 413);
  let b: Record<string, unknown>;
  try { b = JSON.parse(raw); } catch { return json({ error: 'bad json' }, 400); }
  const session = clip(b.session, 64), runId = clip(b.runId, 64), event = clip(b.event, 16);
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(session) || !/^[a-zA-Z0-9-]{8,64}$/.test(runId) || !events.has(event)) return json({ error: 'bad event' }, 400);
  if (!PROVEN_KEY.test(clip(b.courseKey, 100))) return json({ ok: true, skipped: 'no proven path for this course' });
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM course_events WHERE session = ? AND ts > datetime('now', '-1 hour')").bind(session).first<{ n: number }>();
  if ((recent?.n ?? 0) >= 500) return json({ error: 'slow down' }, 429);
  const row = [session, clip(b.build, 40), clip(b.mode, 20), clip(b.source, 30), clip(b.courseKey, 100), clip(b.courseName, 160), runId, event];
  // CC-108: the country (two letters, from Cloudflare; no address) and the zone of a failure; before migration 0009 the plain insert is used
  const country = String((request as { cf?: { country?: string } }).cf?.country ?? '').toUpperCase(), failAt = event === 'fail' ? clip(b.at, 40).replace(/[^a-zA-Z0-9 _-]/g, '') : '';
  try {
    await env.DB.prepare("INSERT OR IGNORE INTO course_events (ts, session, build, mode, source, course_key, course_name, run_id, event_type, country, fail_at) VALUES (datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(...row, /^[A-Z]{2}$/.test(country) ? country : '', failAt).run();
  } catch {
    await env.DB.prepare('INSERT OR IGNORE INTO course_events (ts, session, build, mode, source, course_key, course_name, run_id, event_type) VALUES (datetime(\'now\'), ?, ?, ?, ?, ?, ?, ?, ?)').bind(...row).run();
  }
  return json({ ok: true });
};
