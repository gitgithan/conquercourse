// /api/segment: a player's photo -> suggested things to pick (CC-248), through the Modal job (pipelines/photo_to_object.py: suggest_submit and suggest_status).
//   POST {action:"submit", image, thumb} -> {id}
//   POST {action:"submit", image, thumb, box:[x0,y0,x1,y1]} -> {id}; the reply of status then holds one item, the cut-out of that box (CC-133, "Mark it yourself")
//   POST {action:"status", id} -> {state:"running"} | {state:"done", items, privacy, seconds} | {state:"failed", reason}
// The same switch and the same safety check as /api/object-lift: with no secret set the route answers 503, and the photo is checked by Muse Spark Open first.
import { waitTimer } from '../_lib/analytics';
import { playerCode } from '../_lib/player';
import { recordStop } from '../_lib/stops';
import { moderationStops } from '../../src/slice/object-lift';
import { segmentProblem } from '../../src/slice/segment';
import { askModeration } from './moderate';
import { limited, waitSeconds } from '../_lib/limit';
import { refusalBody } from '../../src/slice/stages';
import { json } from '../_lib/http';
import { checkTurnstile, makePass, type TurnstileEnv } from '../_lib/turnstile';
import { featureOn, offWords, recordUsage, type UsageDb } from '../_lib/usage';

interface Env { DB?: UsageDb; CC_UPLOAD_TOKEN?: string; CC_SEGMENT_SUBMIT_URL?: string; CC_SEGMENT_STATUS_URL?: string; CC_SEGMENT_WARM_URL?: string; BASETEN_API_KEY?: string }
const MODAL_HOST = /^https:\/\/[a-z0-9-]+--[a-z0-9-]+(\.[a-z0-9-]+)?\.modal\.run\/?$/;

/** Warm-up (CC-133): starts the finder or the 3D maker early so the model is loaded when the player needs it. No photo, nothing is processed, never waits for the machine. */
export async function warm(b: Record<string, unknown>, env: Env, ip: string, fetcher: typeof fetch = fetch, burstMax = 6, now = Date.now()): Promise<{ status: number; body: Record<string, unknown> }> {
  if (b.which !== 'mask' && b.which !== 'lift') return { status: 400, body: { error: 'bad' } };
  if (!env.CC_UPLOAD_TOKEN || !env.CC_SEGMENT_WARM_URL || !MODAL_HOST.test(env.CC_SEGMENT_WARM_URL)) return { status: 204, body: {} };
  if (limited(`warm:${ip}`, now, burstMax)) return { status: 429, body: { error: 'busy' } };
  try { await fetcher(env.CC_SEGMENT_WARM_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: env.CC_UPLOAD_TOKEN, which: b.which }) }); } catch { /* the page does not care */ }
  return { status: 200, body: { ok: true } };
}

export async function handle(b: Record<string, unknown>, env: Env, ip: string, fetcher: typeof fetch = fetch, burstMax = 10, now = Date.now()): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!env.CC_UPLOAD_TOKEN || !env.CC_SEGMENT_SUBMIT_URL || !env.CC_SEGMENT_STATUS_URL || !MODAL_HOST.test(env.CC_SEGMENT_SUBMIT_URL) || !MODAL_HOST.test(env.CC_SEGMENT_STATUS_URL)) return { status: 503, body: { error: 'off', message: 'Suggestions are switched off right now. You can draw boxes by hand.' } };
  const call = async (url: string, payload: unknown): Promise<Record<string, unknown>> => {
    const res = await fetcher(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as Record<string, unknown>;
  };
  if (b.action === 'status') {
    const id = typeof b.id === 'string' && /^fc-[A-Za-z0-9]{10,40}$/.test(b.id) ? b.id : '';
    if (!id) return { status: 400, body: { state: 'failed', reason: 'bad' } };
    try { return { status: 200, body: await call(env.CC_SEGMENT_STATUS_URL, { token: env.CC_UPLOAD_TOKEN, id }) }; } catch { return { status: 502, body: { state: 'failed', reason: 'down' } }; }
  }
  if (b.action !== 'submit') return { status: 400, body: { error: 'bad' } };
  const problem = segmentProblem(b);
  if (problem) return { status: 400, body: { error: 'bad', message: problem } };
  if (limited(`seg:${ip}`, now, burstMax)) return { status: 429, body: refusalBody('busy', 'You asked for a lot of suggestions just now. Wait a few minutes.', waitSeconds(`seg:${ip}`, now)) };
  let moderation = 'skipped';
  if (env.BASETEN_API_KEY) {
    const m = await askModeration(env.BASETEN_API_KEY, { image: b.thumb as string }, fetcher);
    const stop = moderationStops(m.body.verdict, m.body.reason);
    if (stop) { await recordStop(env.DB as never, 'segment', await playerCode(ip), m.body.verdict, m.body.reason, now); return { status: 403, body: { error: 'moderation', message: stop } }; }
    moderation = `${m.body.verdict}:${m.body.reason}`;
  }
  try {
    const img = b.image as string;
    const out = await call(env.CC_SEGMENT_SUBMIT_URL, { token: env.CC_UPLOAD_TOKEN, image: img.slice(img.indexOf(',') + 1), ...(Array.isArray(b.box) ? { box: b.box } : {}) });
    if (typeof out.id !== 'string') return { status: 400, body: { error: 'bad', message: String(out.error ?? '') } };
    return { status: 200, body: { id: out.id, moderation } };
  } catch { return { status: 502, body: refusalBody('down', 'The outline finder is busy. Try again in a minute.', 60) }; }
}

export const onRequestPost = async (ctx: { request: Request; env: Env & TurnstileEnv }): Promise<Response> => {
  try { return await post(ctx); } catch (e) { console.error('route failed', String(e)); return json({ error: 'down', message: 'The outline finder hit a snag. Try again in a minute.', retryAfterSeconds: 30 }, 502, { 'retry-after': '30' }); } // never a bare server-error page: the page can only say "not answering" to those
};
const post = async ({ request, env }: { request: Request; env: Env & TurnstileEnv }): Promise<Response> => {
  const raw = await request.text();
  if (raw.length > 2_200_000) return json({ error: 'bad', message: 'The photo is too big.' }, 413);
  let b: Record<string, unknown>;
  try { b = JSON.parse(raw); } catch { return json({ error: 'bad' }, 400); }
  const ip = request.headers.get('cf-connecting-ip') ?? 'local';
  if (b.action === 'warm') {
    if (!(await featureOn(env.DB, 'segment'))) return json({ error: 'off' }, 503);
    const w = await warm(b, env, ip);
    return w.status === 204 ? new Response(null, { status: 204 }) : json(w.body, w.status);
  }
  const submit = b.action === 'submit';
  if (submit && !(await featureOn(env.DB, 'segment'))) return json({ error: 'off', message: offWords('segment') }, 503);
  if (submit) { const c = await checkTurnstile(env, b.turnstile, ip); if (!c.ok) return json({ error: 'check', message: c.message }, 403); }
  const wt = waitTimer('segment');
  const r = await handle(b, env, ip, submit ? wt.fetcher : fetch);
  if (submit) await wt.flush(env.DB);
  if (submit && r.status === 200) { const pass = await makePass(env, b.image); if (pass) (r.body as Record<string, unknown>).pass = pass; }
  if (submit && r.status === 200) await recordUsage(env.DB, 'segment');
  const wait = (r.body as { retryAfterSeconds?: number }).retryAfterSeconds;
  return json(r.body, r.status, typeof wait === 'number' ? { 'retry-after': String(wait) } : {});
};
