// POST /api/submit: store one structured feedback submission in D1.
// Defences: small body, whitelisted fields, a honeypot, and at most 5 submissions per session per hour.
interface Env { DB: { prepare(sql: string): { bind(...v: unknown[]): { run(): Promise<unknown>; first<T>(): Promise<T | null> } } } }

const clip = (v: unknown, n: number): string => String(v ?? '').slice(0, n);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  const raw = await request.text();
  if (raw.length > 8000) return json({ error: 'too long' }, 413);
  let b: Record<string, unknown>;
  try { b = JSON.parse(raw); } catch { return json({ error: 'bad json' }, 400); }
  if (b.website) return json({ ok: true }); // honeypot: a person never fills this field
  const session = clip(b.session, 64);
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(session)) return json({ error: 'bad session' }, 400);
  const answers: Record<string, string | number> = {};
  const given = (b.answers ?? {}) as Record<string, unknown>;
  for (const k of Object.keys(given).slice(0, 40)) {
    if (!/^[a-z0-9_-]{1,40}$/.test(k)) continue;
    const v = given[k];
    answers[k] = typeof v === 'number' ? Math.max(0, Math.min(10, v)) : clip(v, 1000);
  }
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM feedback WHERE session = ? AND ts > datetime('now', '-1 hour')").bind(session).first<{ n: number }>();
  if ((recent?.n ?? 0) >= 5) return json({ error: 'slow down' }, 429);
  const context = JSON.stringify(Object.fromEntries(Object.entries((b.context ?? {}) as Record<string, unknown>).slice(0, 20).map(([k, v]) => [clip(k, 30), typeof v === 'number' ? v : clip(v, 60)])));
  await env.DB.prepare('INSERT INTO feedback (ts, round, session, build, mode, answers, context) VALUES (datetime(\'now\'), ?, ?, ?, ?, ?, ?)')
    .bind(clip(b.round, 40), session, clip(b.build, 40), clip(b.mode, 20), JSON.stringify(answers), context).run();
  return json({ ok: true });
};
