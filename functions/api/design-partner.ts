// /api/design-partner: Lab 18's one-shot design critique by Muse Spark Open on Baseten. Not a chat: one layout in, one short comment out.
//   POST {scenario, blocks: [ids], note?} -> {reply}
// Only known block ids (one per slot of the block board, or the older list) and a 120-character note reach the model. The key lives only in the BASETEN_API_KEY secret. Reasoning text is never read.
import { cleanLayout, cleanReply, layoutPrompt, PARTNER_SYSTEM } from '../../src/labs/systemdesign/partner-core';
import { cleanDesign, designPrompt } from '../../src/labs/systemdesign/pipeline';
import { limited } from '../_lib/limit';
import { MODEL, URL_CHAT } from './designer';
import { json } from '../_lib/http';
import { featureOn, offWords, recordUsage, type UsageDb } from '../_lib/usage';

interface Env { DB?: UsageDb; BASETEN_API_KEY?: string }
export const MAX_BODY = 4_000;
export const MAX_TOKENS = 6000; // Muse Spark Open reasons first and counts it; 6,000 leaves room. Worst case about 2.6 cents.
export const TIMEOUT_MS = 24_000, LIMIT = 6; // 6 asks in 10 minutes for one address

export async function askPartner(key: string, b: unknown, fetcher: typeof fetch = fetch): Promise<{ status: number; body: { reply?: string; error?: string } }> {
  // The block board sends {brief, design: {slot: block}, note}; the older list of blocks still works.
  const dz = b && typeof b === 'object' && 'design' in b ? cleanDesign(b) : null;
  const l = dz ? null : cleanLayout(b);
  if (!dz && !l) return { status: 400, body: { error: 'send a scenario and between one and thirty known blocks, or a brief and one known block for each slot' } };
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetcher(URL_CHAT, { method: 'POST', signal: ctl.signal, headers: { 'content-type': 'application/json', authorization: `Api-Key ${key}` }, body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, messages: [{ role: 'system', content: PARTNER_SYSTEM }, { role: 'user', content: dz ? designPrompt(dz) : layoutPrompt(l!) }] }) });
    if (!res.ok) return { status: 502, body: { error: `the partner is unavailable (${res.status})` } };
    const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
    const reply = cleanReply(data.choices?.[0]?.message?.content ?? '');
    if (!reply) return { status: 502, body: { error: 'the partner ran out of room to answer' } };
    return { status: 200, body: { reply } };
  } catch { return { status: 504, body: { error: 'the partner was too slow' } }; } finally { clearTimeout(t); }
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  if (!env.BASETEN_API_KEY || !(await featureOn(env.DB, 'agent'))) return json({ error: offWords('agent') }, 503);
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ error: 'too big' }, 413);
  let b: unknown;
  try { b = JSON.parse(raw); } catch { return json({ error: 'bad json' }, 400); }
  if (limited(`dpartner:${request.headers.get('cf-connecting-ip') ?? 'local'}`, Date.now(), LIMIT)) return json({ error: 'slow down a little' }, 429);
  const r = await askPartner(env.BASETEN_API_KEY, b);
  if (r.status === 200) await recordUsage(env.DB, 'agent');
  return json(r.body, r.status);
};
