// /api/object-lift: a player's photo and box -> a 3D object, through the Modal job (pipelines/photo_to_object.py: submit and status).
//   POST {action:"submit", image, thumb, label, box, width, height, height_m?, padretry?} -> {id}
//   POST {action:"status", id} -> {state:"running"} | {state:"done", glb (base64), mesh, privacy, retry, seconds} | {state:"failed", reason}
// The Modal token lives only in the CC_UPLOAD_TOKEN secret; nothing is stored here. A switch: with no secret set the route answers 503, so it is off by default.
// The photo is checked by Muse Spark Open first (askModeration). People are allowed (the pipeline blurs them); real worries stop the job. A broken checker is recorded as "skipped".
import { cleanRequest, moderationStops, requestProblem } from '../../src/slice/object-lift';
import { askModeration } from './moderate';
import { limited, waitSeconds } from './designer';
import { refusalBody, secondsToNextDay } from '../../src/slice/stages';
import { d1Ledger } from '../../src/slice/d1-ledger';
import { LIMIT_WORDS, memoryLedger, utcDay, DEFAULT_LIMITS, type Ledger, type Limits } from '../../src/slice/upload-gates';
import { playerCode } from '../_lib/player';
import { json } from '../_lib/http';
import { featureOn, offWords, recordUsage } from '../_lib/usage';
import { makeReceipt } from '../_lib/receipt';
import { checkTurnstile, type TurnstileEnv } from '../_lib/turnstile';

interface Env { DB?: Parameters<typeof d1Ledger>[0]; CC_UPLOAD_TOKEN?: string; CC_UPLOAD_SUBMIT_URL?: string; CC_UPLOAD_STATUS_URL?: string; BASETEN_API_KEY?: string }
const MODAL_HOST = /^https:\/\/[a-z0-9-]+--[a-z0-9-]+(\.[a-z0-9-]+)?\.modal\.run\/?$/; // the app host may carry a region: x--y.us-east.modal.run

const sharedLedger = memoryLedger(); // only for local runs without a database; with DB the count lives in D1 and is the same for every server

// The gates, in order: request shape -> burst limit -> safety check -> daily slot -> start the job. A slot is taken only after the photo passed
// the safety check, and given back if the job never started, so a refusal never costs the player a try.
export { playerCode };

export async function handle(b: Record<string, unknown>, env: Env, ip: string, fetcher: typeof fetch = fetch, burstMax = 6, ledger: Ledger = sharedLedger, limits: Limits = DEFAULT_LIMITS, now = Date.now()): Promise<{ status: number; body: unknown }> {
  if (!env.CC_UPLOAD_TOKEN || !env.CC_UPLOAD_SUBMIT_URL || !env.CC_UPLOAD_STATUS_URL || !MODAL_HOST.test(env.CC_UPLOAD_SUBMIT_URL) || !MODAL_HOST.test(env.CC_UPLOAD_STATUS_URL)) return { status: 503, body: { error: 'not allowed' } };
  const call = async (url: string, payload: unknown): Promise<unknown> => {
    const res = await fetcher(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  };
  if (b.action === 'status') {
    const id = typeof b.id === 'string' && /^fc-[A-Za-z0-9]{10,40}$/.test(b.id) ? b.id : '';
    if (!id) return { status: 400, body: { state: 'failed', reason: 'bad' } };
    try {
      const body = (await call(env.CC_UPLOAD_STATUS_URL, { token: env.CC_UPLOAD_TOKEN, id })) as Record<string, unknown>;
      if (body.state === 'done' && typeof body.glb === 'string') body.receipt = await makeReceipt(env, id, body.glb).catch(() => undefined); // made for exactly this piece
      return { status: 200, body };
    } catch { return { status: 502, body: { state: 'failed', reason: 'down' } }; }
  }
  if (b.action !== 'submit') return { status: 400, body: { error: 'bad' } };
  const problem = requestProblem(b);
  if (problem) return { status: 400, body: { error: 'bad', message: problem } };
  if (limited(`lift:${ip}`, now, burstMax)) return { status: 429, body: refusalBody('busy', 'You made a lot of objects just now. Wait a few minutes.', waitSeconds(`lift:${ip}`, now)) };
  const r = cleanRequest(b);
  let moderation = 'skipped';
  if (env.BASETEN_API_KEY) {
    const m = await askModeration(env.BASETEN_API_KEY, { image: r.thumb }, fetcher);
    const stop = moderationStops(m.body.verdict, m.body.reason);
    if (stop) return { status: 403, body: { error: 'moderation', message: stop } };
    moderation = `${m.body.verdict}:${m.body.reason}`;
  }
  const day = utcDay(now), who = await playerCode(ip);
  const slot = await ledger.take(who, day, limits);
  if (!slot.ok) return { status: 429, body: refusalBody(slot.limit === 'game' ? 'budget' : 'daily', LIMIT_WORDS[slot.limit], secondsToNextDay(now)) };
  try {
    const out = (await call(env.CC_UPLOAD_SUBMIT_URL, { token: env.CC_UPLOAD_TOKEN, image: r.image.slice(r.image.indexOf(',') + 1), label: r.label, box: r.box, height_m: r.height_m, padretry: r.padretry })) as { id?: string; error?: string };
    if (!out.id) { await ledger.refund(who, day); return { status: 400, body: { error: out.error === 'not allowed' ? 'not allowed' : 'bad', message: out.error ?? '' } }; }
    return { status: 200, body: { id: out.id, moderation } };
  } catch { await ledger.refund(who, day); return { status: 502, body: refusalBody('down', 'The 3D service is busy. Try again in a minute.', 60) }; }
}

/** What the page shows before the make button: how many pieces a player can make a day and how many are left today. Reads only; nothing is taken. */
export async function pieceCount(ip: string, ledger: Ledger = sharedLedger, limits: Limits = DEFAULT_LIMITS, now = Date.now()): Promise<{ perDay: number; left: number }> {
  return { perDay: limits.perPlayer, left: await ledger.left(await playerCode(ip), utcDay(now), limits) };
}

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  try { return json(await pieceCount(request.headers.get('cf-connecting-ip') ?? 'local', env.DB ? d1Ledger(env.DB) : sharedLedger), 200, { 'cache-control': 'no-store' }); } catch { return json({ error: 'down' }, 502); }
};

export const onRequestPost = async ({ request, env }: { request: Request; env: Env & TurnstileEnv }): Promise<Response> => {
  const raw = await request.text();
  if (raw.length > 2_200_000) return json({ error: 'bad', message: 'The photo is too big.' }, 413);
  let b: Record<string, unknown>;
  try { b = JSON.parse(raw); } catch { return json({ error: 'bad' }, 400); }
  const submit = b.action === 'submit';
  if (submit && !(await featureOn(env.DB, 'photo3d'))) return json({ error: 'off', message: offWords('photo3d') }, 503);
  if (submit) { const c = await checkTurnstile(env, b.turnstile, request.headers.get('cf-connecting-ip') ?? 'local', fetch, b.pass, b.image); if (!c.ok) return json({ error: 'check', message: c.message }, 403); }
  const r = await handle(b, env, request.headers.get('cf-connecting-ip') ?? 'local', fetch, 6, env.DB ? d1Ledger(env.DB) : sharedLedger);
  if (submit && r.status === 200) await recordUsage(env.DB, 'photo3d');
  const wait = (r.body as { retryAfterSeconds?: number }).retryAfterSeconds;
  return json(r.body, r.status, wait ? { 'retry-after': String(wait) } : {});
};
