import type { Shrunk } from './object-lift-client';
import { cleanSuggestions, type Suggestion } from './segment';

// The page side of /api/segment (CC-248): send the shrunk photo, poll, and get clickable suggestions back. Throws an Error with a plain-words message.
const post = async (body: unknown): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> => {
  const res = await fetch('/api/segment', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  let data: Record<string, unknown> = {};
  try { data = (await res.json()) as Record<string, unknown>; } catch { /* a broken reply is a failure below */ }
  return { ok: res.ok, status: res.status, data };
};

export async function suggestRegions(photo: Shrunk, progress: (s: string) => void, signal?: AbortSignal): Promise<Suggestion[]> {
  progress('Looking for things you could pick. People in the photo are blurred first.');
  const sub = await post({ action: 'submit', image: photo.image, thumb: photo.thumb });
  if (!sub.ok || typeof sub.data.id !== 'string') throw new Error(typeof sub.data.message === 'string' && sub.data.message ? sub.data.message : 'Suggestions are not available right now. You can draw boxes by hand.');
  const t0 = Date.now();
  for (let i = 0; i < 60; i++) {
    if (signal?.aborted) throw new Error('Stopped.');
    await new Promise((r) => setTimeout(r, i < 3 ? 3000 : 5000));
    const s = (await post({ action: 'status', id: sub.data.id })).data;
    if (s.state === 'running') { progress(`Looking for things you could pick (${Math.round((Date.now() - t0) / 1000)} s). You can already draw boxes.`); continue; }
    if (s.state === 'done') return cleanSuggestions(s.items, photo.width, photo.height);
    break;
  }
  throw new Error('No suggestions this time. You can draw boxes by hand.');
}
