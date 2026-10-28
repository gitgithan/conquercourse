// /api/places?lat=48.8867&lon=2.3431&r=120: the buildings of a place, from OpenStreetMap (CC-78).
//   -> {elements: [...], source: "<server>", cache: "hit" | "miss"}   (the same shape as an Overpass answer, trimmed)
// Why it exists: the public map servers are often slow or refuse; asking all of them at once from here, and keeping the answer,
// means a pin gives a place in a second or two for everybody after the first. The cache is the Cloudflare Cache API on the edge
// (free, no setup, per data centre); D1 would be shared across data centres but needs a migration and one more binding for answers
// that are only a cache. Answers are kept 30 days (buildings change slowly; nothing here is private).
// Defences: radius 60 to 300 m, at most 20 new places per address in ten minutes (cache hits are free), answers capped in size.
import { askMirrors, parseRequest, placeKey } from '../../src/world/places';

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', ...extra } });

const hits = new Map<string, number[]>();
export function limited(ip: string, now = Date.now(), max = 20, windowMs = 600_000): boolean {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) { hits.set(ip, recent); return true; }
  recent.push(now); hits.set(ip, recent);
  return false;
}

export const MAX_ANSWER_BYTES = 1_500_000;
const TTL = 60 * 60 * 24 * 30;

// The whole lookup, shared by the Pages Function and the dev server: a store (get/put by key), then the mirrors.
export async function lookup(q: URLSearchParams, ip: string, store: { get(key: string): Promise<string | null>; put(key: string, value: string): Promise<void> }, fetcher: typeof fetch = fetch, now = Date.now()): Promise<{ status: number; body: unknown; headers: Record<string, string> }> {
  const r = parseRequest(q);
  if (typeof r === 'string') return { status: 400, body: { error: r }, headers: {} };
  const key = placeKey(r);
  const kept = await store.get(key);
  if (kept) return { status: 200, body: { ...JSON.parse(kept), cache: 'hit' }, headers: { 'x-cache': 'hit' } };
  if (limited(ip, now)) return { status: 429, body: { error: 'slow down a little' }, headers: {} };
  try {
    const got = await askMirrors(r, { fetcher, timeoutMs: 28000 });
    const text = JSON.stringify({ elements: got.answer.elements, source: got.mirror });
    if (text.length > MAX_ANSWER_BYTES) return { status: 413, body: { error: 'that place has too many buildings; use a smaller radius' }, headers: {} };
    await store.put(key, text);
    return { status: 200, body: { ...JSON.parse(text), cache: 'miss', ms: got.ms }, headers: { 'x-cache': 'miss', 'x-mirror': got.mirror, 'x-ms': String(got.ms) } };
  } catch (e) {
    return { status: 504, body: { error: 'the map data servers did not answer', detail: (e as Error).message.slice(0, 300), readyPlaces: true }, headers: {} };
  }
}

export const onRequestGet = async ({ request, waitUntil }: { request: Request; waitUntil?: (p: Promise<unknown>) => void }): Promise<Response> => {
  const url = new URL(request.url);
  const cache = (globalThis as unknown as { caches?: { default: Cache } }).caches?.default;
  const store = {
    async get(key: string) { if (!cache) return null; const hit = await cache.match(new Request(`https://places.cache.invalid/${key}`)); return hit ? hit.text() : null; },
    async put(key: string, value: string) {
      if (!cache) return;
      const put = cache.put(new Request(`https://places.cache.invalid/${key}`), new Response(value, { headers: { 'content-type': 'application/json', 'cache-control': `public, max-age=${TTL}` } }));
      if (waitUntil) waitUntil(put); else await put;
    },
  };
  const r = await lookup(url.searchParams, request.headers.get('cf-connecting-ip') ?? 'local', store);
  return json(r.body, r.status, r.headers);
};
