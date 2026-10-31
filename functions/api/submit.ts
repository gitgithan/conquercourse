import { json } from '../_lib/http';
import { KINDS, WHY_CHIPS, CONTEXT_KEYS, LIMITS, ROUND } from '../../src/ui/feedback-model';
// POST /api/submit: store one structured feedback submission in D1.
// Defences: small body, whitelisted fields, a honeypot, and at most 5 submissions per session per hour.
interface Env { DB: { prepare(sql: string): { bind(...v: unknown[]): { run(): Promise<unknown>; first<T>(): Promise<T | null> } } } }

const clip = (v: unknown, n: number): string => String(v ?? '').slice(0, n);
// Free text: control characters become spaces, and anything shaped like an email address or a web link is removed before it is stored.
const clean = (v: unknown, n: number): string => String(v ?? '').replace(/[\u0000-\u001f]+/g, ' ').replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[removed]').replace(/https?:\/\/\S+/gi, '[link removed]').trim().slice(0, n);

/** The new card (v 2): only the named fields, each checked against a short list or a size limit. */
function structured(b: Record<string, unknown>): { answers: Record<string, string | number>; context: Record<string, string> } | null {
  const given = (b.answers ?? {}) as Record<string, unknown>;
  const answers: Record<string, string | number> = {};
  if (given.kind !== undefined) { if (!(KINDS as readonly string[]).includes(String(given.kind))) return null; answers.kind = String(given.kind); }
  const where = clean(given.where, LIMITS.where); if (where) answers.where = where;
  const text = clean(given.text, LIMITS.text); if (text) answers.text = text;
  if (given.rating !== undefined) { const r = Number(given.rating); if (!Number.isInteger(r) || r < 1 || r > LIMITS.rating) return null; answers.rating = r; }
  if (given.clear !== undefined) { if (given.clear !== 'yes' && given.clear !== 'no') return null; answers.clear = given.clear; }
  if (given.why !== undefined) { if (!(WHY_CHIPS as readonly string[]).includes(String(given.why))) return null; answers.why = String(given.why); }
  if (!Object.keys(answers).length) return null; // an empty note carries nothing
  const context: Record<string, string> = {};
  const c = (b.context ?? {}) as Record<string, unknown>;
  for (const k of CONTEXT_KEYS) if (c[k] !== undefined && c[k] !== '') context[k] = clean(c[k], LIMITS.context);
  return { answers, context };
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  const raw = await request.text();
  if (raw.length > 8000) return json({ error: 'too long' }, 413);
  let b: Record<string, unknown>;
  try { b = JSON.parse(raw); } catch { return json({ error: 'bad json' }, 400); }
  if (b.website) return json({ ok: true }); // honeypot: a person never fills this field
  const session = clip(b.session, 64);
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(session)) return json({ error: 'bad session' }, 400);
  const v2 = b.v === 2 ? structured(b) : null;
  if (b.v === 2 && !v2) return json({ error: 'bad note' }, 400);
  const answers: Record<string, string | number> = {};
  const given = (b.answers ?? {}) as Record<string, unknown>;
  for (const k of Object.keys(given).slice(0, 40)) {
    if (!/^[a-z0-9_-]{1,40}$/.test(k)) continue;
    const v = given[k];
    answers[k] = typeof v === 'number' ? Math.max(0, Math.min(10, v)) : clip(v, 1000);
  }
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM feedback WHERE session = ? AND ts > datetime('now', '-1 hour')").bind(session).first<{ n: number }>();
  if ((recent?.n ?? 0) >= 5) return json({ error: 'slow down' }, 429);
  const context = v2 ? JSON.stringify(v2.context) : JSON.stringify(Object.fromEntries(Object.entries((b.context ?? {}) as Record<string, unknown>).slice(0, 20).map(([k, v]) => [clip(k, 30), typeof v === 'number' ? v : clip(v, 60)])));
  await env.DB.prepare('INSERT INTO feedback (ts, round, session, build, mode, answers, context) VALUES (datetime(\'now\'), ?, ?, ?, ?, ?, ?)')
    .bind(v2 ? ROUND : clip(b.round, 40), session, clip(b.build, 40), clip(b.mode, 20), JSON.stringify(v2 ? v2.answers : answers), context).run();
  return json({ ok: true });
};
