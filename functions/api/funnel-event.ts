import { json } from '../_lib/http';
import { recordStep, type AnalyticsDb } from '../_lib/analytics';
// POST /api/funnel-event {session, step, ref}: one funnel step (CC-108). The step must be on the list in _lib/analytics.ts; a repeat the same day is ignored.
interface Env { DB?: AnalyticsDb }
export const onRequestPost = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  const raw = await request.text();
  if (raw.length > 500) return json({ error: 'too long' }, 413);
  let b: Record<string, unknown>;
  try { b = JSON.parse(raw); } catch { return json({ error: 'bad json' }, 400); }
  const country = String((request as { cf?: { country?: string } }).cf?.country ?? '');
  const ok = await recordStep(env.DB, { session: String(b.session ?? ''), step: b.step, ref: b.ref, country });
  return json({ ok });
};
