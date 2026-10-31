// /api/course-agent: one turn of the Course Agent, a thin call to Muse Spark Open on Baseten. Text only: the photo input was dropped 2026-10-31 (scope is photo to object only).
//   POST {messages: [{role, content}]} -> {reply: <model text with a json layout>}
// The loop itself (propose, test with the simulator, repair, stop) runs in the browser, where the simulator is; this function only holds the key.
// Defences: key only in the BASETEN_API_KEY secret, reasoning text dropped, small bodies, a rate limit (a loop makes up to six calls).
import { AGENT_SYSTEM } from '../../src/slice/course-agent';
import { limited, MAX_TOKENS, MODEL, URL_CHAT } from './designer';
import { json } from '../_lib/http';

interface Env { BASETEN_API_KEY?: string }
export const MAX_TURNS = 4, MAX_TURN_CHARS = 4_000, MAX_REQUEST_BODY = 20_000; // text only: no photo goes to this function

export async function askAgent(key: string, b: Record<string, unknown>, fetcher: typeof fetch = fetch): Promise<{ status: number; body: { reply?: string; error?: string; usage?: { in: number; out: number } } }> {
  const turns = Array.isArray(b.messages) ? b.messages : [];
  if (!turns.length || turns.length > MAX_TURNS) return { status: 400, body: { error: 'send between one and four messages' } };
  const clean: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const t of turns as Record<string, unknown>[]) {
    if ((t?.role !== 'user' && t?.role !== 'assistant') || typeof t.content !== 'string' || !t.content.trim() || t.content.length > MAX_TURN_CHARS) return { status: 400, body: { error: 'a message is missing, empty or too long' } };
    clean.push({ role: t.role, content: t.content });
  }
  if (clean[0].role !== 'user' || clean[clean.length - 1].role !== 'user') return { status: 400, body: { error: 'start and end with a user message' } };
  const messages: unknown[] = [{ role: 'system', content: AGENT_SYSTEM }, ...clean];
  const res = await fetcher(URL_CHAT, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Api-Key ${key}` }, body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, messages }) });
  if (!res.ok) return { status: 502, body: { error: `the course agent is unavailable (${res.status})` } };
  const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
  const reply = (data.choices?.[0]?.message?.content ?? '').trim();
  if (!reply) return { status: 502, body: { error: 'the helper ran out of room to answer; try again' } };
  return { status: 200, body: { reply, usage: { in: data.usage?.prompt_tokens ?? 0, out: data.usage?.completion_tokens ?? 0 } } };
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  if (!env.BASETEN_API_KEY) return json({ error: 'the course agent is not switched on here' }, 503);
  const raw = await request.text();
  if (raw.length > MAX_REQUEST_BODY) return json({ error: 'too big' }, 413);
  let b: Record<string, unknown>;
  try { b = JSON.parse(raw); } catch { return json({ error: 'bad json' }, 400); }
  if (limited(`agent:${request.headers.get('cf-connecting-ip') ?? 'local'}`, Date.now(), 30)) return json({ error: 'slow down a little' }, 429);
  try { const r = await askAgent(env.BASETEN_API_KEY, b); return json(r.body, r.status); } catch { return json({ error: 'the course agent is unavailable' }, 502); }
};
