// /api/photo-course: a park photo becomes a first course layout, drafted by Muse Spark Open on Baseten (it can see images).
//   POST {image: "data:image/jpeg;base64,..."} -> {reply: <model text with a json layout>}
// Same key and defences as /api/designer (key only in the BASETEN_API_KEY secret, reasoning text dropped), plus: only a small JPEG or PNG, and a tighter rate limit.
import { PHOTO_PROMPT } from '../../src/slice/photo-course';
import { limited, MAX_TOKENS, MODEL, URL_CHAT } from './designer';

interface Env { BASETEN_API_KEY?: string }
export const MAX_PHOTO_BODY = 600_000; // about a 768 px JPEG as base64
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export async function askPhoto(key: string, b: Record<string, unknown>, fetcher: typeof fetch = fetch): Promise<{ status: number; body: { reply?: string; error?: string } }> {
  const image = typeof b.image === 'string' ? b.image : '';
  if (!/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(image) || image.length > MAX_PHOTO_BODY) return { status: 400, body: { error: 'send one small JPEG or PNG photo' } };
  const res = await fetcher(URL_CHAT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Api-Key ${key}` },
    body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, messages: [{ role: 'system', content: PHOTO_PROMPT }, { role: 'user', content: [{ type: 'text', text: 'Here is the photo.' }, { type: 'image_url', image_url: { url: image } }] }] }),
  });
  if (!res.ok) return { status: 502, body: { error: `the draft helper is unavailable (${res.status})` } };
  const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
  const reply = (data.choices?.[0]?.message?.content ?? '').trim();
  if (!reply) return { status: 502, body: { error: 'the helper ran out of room to answer; try again' } };
  return { status: 200, body: { reply } };
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  if (!env.BASETEN_API_KEY) return json({ error: 'the photo helper is not switched on here' }, 503);
  const raw = await request.text();
  if (raw.length > MAX_PHOTO_BODY + 200) return json({ error: 'too big' }, 413);
  let b: Record<string, unknown>;
  try { b = JSON.parse(raw); } catch { return json({ error: 'bad json' }, 400); }
  if (limited(`photo:${request.headers.get('cf-connecting-ip') ?? 'local'}`, Date.now(), 6)) return json({ error: 'slow down a little' }, 429);
  try { const r = await askPhoto(env.BASETEN_API_KEY, b); return json(r.body, r.status); } catch { return json({ error: 'the photo helper is unavailable' }, 502); }
};
