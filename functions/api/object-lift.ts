// /api/object-lift: a player's photo and box -> a 3D object, through the Modal job (pipelines/photo_to_object.py: submit and status).
//   POST {action:"submit", image, thumb, label, box, width, height, height_m?, padretry?} -> {id}
//   POST {action:"status", id} -> {state:"running"} | {state:"done", glb (base64), mesh, privacy, retry, seconds} | {state:"failed", reason}
// The Modal token lives only in the CC_UPLOAD_TOKEN secret; nothing is stored here. A switch: with no secret set the route answers 503, so it is off by default.
// The photo is checked by Muse Spark Open first (askModeration). People are allowed (the pipeline blurs them); real worries stop the job. A broken checker is recorded as "skipped".
import { cleanRequest, moderationStops, requestProblem } from '../../src/slice/object-lift';
import { askModeration } from './moderate';
import { limited } from './designer';
import { json } from '../_lib/http';

interface Env { CC_UPLOAD_TOKEN?: string; CC_UPLOAD_SUBMIT_URL?: string; CC_UPLOAD_STATUS_URL?: string; BASETEN_API_KEY?: string }
const MODAL_HOST = /^https:\/\/[a-z0-9-]+--[a-z0-9-]+\.modal\.run\/?$/;

export async function handle(b: Record<string, unknown>, env: Env, ip: string, fetcher: typeof fetch = fetch, now = Date.now()): Promise<{ status: number; body: unknown }> {
  if (!env.CC_UPLOAD_TOKEN || !env.CC_UPLOAD_SUBMIT_URL || !env.CC_UPLOAD_STATUS_URL || !MODAL_HOST.test(env.CC_UPLOAD_SUBMIT_URL) || !MODAL_HOST.test(env.CC_UPLOAD_STATUS_URL)) return { status: 503, body: { error: 'not allowed' } };
  const call = async (url: string, payload: unknown): Promise<unknown> => {
    const res = await fetcher(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  };
  if (b.action === 'status') {
    const id = typeof b.id === 'string' && /^fc-[A-Za-z0-9]{10,40}$/.test(b.id) ? b.id : '';
    if (!id) return { status: 400, body: { state: 'failed', reason: 'bad' } };
    try { return { status: 200, body: await call(env.CC_UPLOAD_STATUS_URL, { token: env.CC_UPLOAD_TOKEN, id }) }; } catch { return { status: 502, body: { state: 'failed', reason: 'down' } }; }
  }
  if (b.action !== 'submit') return { status: 400, body: { error: 'bad' } };
  const problem = requestProblem(b);
  if (problem) return { status: 400, body: { error: 'bad', message: problem } };
  if (limited(`lift:${ip}`, now, 6)) return { status: 429, body: { error: 'busy', message: 'You made a lot of objects just now. Wait a few minutes.' } };
  const r = cleanRequest(b);
  let moderation = 'skipped';
  if (env.BASETEN_API_KEY) {
    const m = await askModeration(env.BASETEN_API_KEY, { image: r.thumb }, fetcher);
    if (m.status === 200) {
      const stop = moderationStops(m.body.verdict, m.body.reason);
      if (stop) return { status: 403, body: { error: 'moderation', message: stop } };
      moderation = `${m.body.verdict}:${m.body.reason}`;
    }
  }
  try {
    const out = (await call(env.CC_UPLOAD_SUBMIT_URL, { token: env.CC_UPLOAD_TOKEN, image: r.image.slice(r.image.indexOf(',') + 1), label: r.label, box: r.box, height_m: r.height_m, padretry: r.padretry })) as { id?: string; error?: string };
    if (!out.id) return { status: 400, body: { error: out.error === 'not allowed' ? 'not allowed' : 'bad', message: out.error ?? '' } };
    return { status: 200, body: { id: out.id, moderation } };
  } catch { return { status: 502, body: { error: 'down' } }; }
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  const raw = await request.text();
  if (raw.length > 2_200_000) return json({ error: 'bad', message: 'The photo is too big.' }, 413);
  let b: Record<string, unknown>;
  try { b = JSON.parse(raw); } catch { return json({ error: 'bad' }, 400); }
  const r = await handle(b, env, request.headers.get('cf-connecting-ip') ?? 'local');
  return json(r.body, r.status);
};
