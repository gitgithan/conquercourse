import { json } from '../_lib/http';
// /api/designer: the in-editor course-design partner, powered by Muse Spark Open on Baseten.
//   POST {messages: [{role, content}], world: <worldBrief JSON string>} -> {reply: <model text, without its reasoning>}
// The key lives only in the BASETEN_API_KEY secret (never in the page); the hackathon key works only with this one model.
// Defences: small body, last 8 short messages, a light per-address rate limit, and the reasoning text is dropped here.
interface Env { BASETEN_API_KEY?: string }

export const MODEL = 'meta-models/muse-spark-open-1026';
export const URL_CHAT = 'https://inference.baseten.co/v1/chat/completions';
export const MAX_BODY = 24_000;
export const MAX_TOKENS = 4000; // Muse Spark Open always reasons first; the answer comes after, so leave room
const SYSTEM = [
  'You are a course-design partner inside a world editor for a ninja-warrior physics game.',
  'The human builds a course from real objects; a runner goes left to right along a 2 m wide lane and must jump from piece to piece over water.',
  'Earth physics only. Never show formulas. Plain words a 13-year-old can follow.',
  'You suggest; you never grade a player or coach technique. The simulator decides what is possible; its verified advice is in the world description, prefer it over guessing.',
  'Pieces named Bar hang in the air (no frame): hands reach a bar up to 2.7 m standing and 3.7 m with a jump, a swing between two bars crosses up to about 10 m of water, the V key vaults a 0.4 to 1.3 m step fast and saves energy, and a plain jump costs some speed on courses with bars.',
  'Reply with at most 3 short sentences. If you suggest changes, add one fenced ```json block with an array of {"piece": id, "dx": m, "dz": m, "dy": m, "scale": factor, "yaw": radians}; use only ids from the world; each move under 10 m.',
].join(' ');

const hits = new Map<string, number[]>();
export function limited(ip: string, now = Date.now(), max = 20, windowMs = 600_000): boolean {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) { hits.set(ip, recent); return true; }
  recent.push(now); hits.set(ip, recent);
  return false;
}

// The model call, shared by the Pages Function and the local dev middleware. Returns the answer text only.
export async function askSpark(key: string, b: Record<string, unknown>, fetcher: typeof fetch = fetch): Promise<{ status: number; body: { reply?: string; error?: string } }> {
  const msgs = Array.isArray(b.messages) ? (b.messages as Record<string, unknown>[]).slice(-8) : [];
  const clean = msgs.filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string').map((m) => ({ role: m.role as string, content: (m.content as string).slice(0, 2000) }));
  if (!clean.length || clean[clean.length - 1].role !== 'user') return { status: 400, body: { error: 'send a question' } };
  const world = typeof b.world === 'string' ? b.world.slice(0, 8000) : '';
  const res = await fetcher(URL_CHAT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Api-Key ${key}` },
    body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, messages: [{ role: 'system', content: `${SYSTEM}\n\nThe world now: ${world}` }, ...clean] }),
  });
  if (!res.ok) return { status: 502, body: { error: `the designer is unavailable (${res.status})` } };
  const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
  const reply = (data.choices?.[0]?.message?.content ?? '').trim();
  if (!reply) return { status: 502, body: { error: 'the designer ran out of room to answer; ask again' } };
  return { status: 200, body: { reply } }; // reasoning_content is never read
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  if (!env.BASETEN_API_KEY) return json({ error: 'the designer is not switched on here' }, 503);
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ error: 'too big' }, 413);
  let b: Record<string, unknown>;
  try { b = JSON.parse(raw); } catch { return json({ error: 'bad json' }, 400); }
  if (limited(request.headers.get('cf-connecting-ip') ?? 'local')) return json({ error: 'slow down a little' }, 429);
  try { const r = await askSpark(env.BASETEN_API_KEY, b); return json(r.body, r.status); } catch { return json({ error: 'the designer is unavailable' }, 502); }
};
