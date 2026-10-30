import { json } from '../_lib/http';
// POST /api/community-report {id, session}: someone flags a course. A course is hidden once 3 different sessions have flagged it.
interface Stmt { bind(...v: unknown[]): { run(): Promise<unknown> } }
interface Env { DB: { prepare(sql: string): Stmt } }

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  const raw = await request.text();
  if (raw.length > 500) return json({ error: 'too long' }, 413);
  let b: Record<string, unknown>;
  try { b = JSON.parse(raw); } catch { return json({ error: 'bad json' }, 400); }
  const id = Number(b.id), session = String(b.session ?? '');
  if (!Number.isInteger(id) || id < 1 || !/^[a-zA-Z0-9-]{8,64}$/.test(session)) return json({ error: 'bad request' }, 400);
  await env.DB.prepare("INSERT OR IGNORE INTO community_reports (course, session, ts) VALUES (?, ?, datetime('now'))").bind(id, session).run();
  await env.DB.prepare('UPDATE community SET reports = (SELECT COUNT(*) FROM community_reports WHERE course = ?) WHERE id = ?').bind(id, id).run();
  return json({ ok: true });
};
