import { CORS, json as baseJson } from '../_lib/http';
import { limited } from '../_lib/limit';
// /api/photos?id=123,456: a fresh picture address for up to three photos, from Mapillary (CC-90).
// /api/photos?lat=55.9496&lon=-3.1904&r=60: the photos within r metres (10 to 100), used offline to refresh the allow-lists (scripts/photos_people.py).
//   -> {photos: [{id, thumb, creator, capturedAt, compass}], cache: "hit" | "miss"}
// Why it exists: Mapillary needs a token, which must stay on the server, and picture addresses expire after a while, so the game asks here when it shows a photo.
// The token is the Pages secret MAPILLARY_TOKEN (npx wrangler pages secret put MAPILLARY_TOKEN); it goes to Mapillary in the Authorization header and is never in an answer.
// Defences: only the five fields above are returned, ids must be digits, at most 3 ids or one small search per call, answers are cached 30 minutes on the edge,
// and each address gets 120 id lookups and 20 searches per ten minutes (best effort: the count lives in one server instance).
const GRAPH = 'https://graph.mapillary.com';
const FIELDS = 'id,thumb_1024_url,creator,captured_at,compass_angle,computed_compass_angle';
export const TTL_S = 1800;
export const LIMITS = { id: 120, search: 20 };

export interface Shown { id: string; thumb: string; creator: string; capturedAt: number | null; compass: number | null }
interface Raw { id?: string; thumb_1024_url?: string; creator?: { username?: string }; captured_at?: number; compass_angle?: number; computed_compass_angle?: number }

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) => baseJson(body, status, { ...CORS, ...extra });

export const trim = (r: Raw): Shown | null => {
  if (!r.id || !r.thumb_1024_url || !/^\d{5,20}$/.test(r.id) || !/^https:\/\//.test(r.thumb_1024_url)) return null;
  return { id: r.id, thumb: r.thumb_1024_url, creator: String(r.creator?.username ?? '').slice(0, 60), capturedAt: typeof r.captured_at === 'number' ? r.captured_at : null, compass: r.computed_compass_angle ?? r.compass_angle ?? null };
};

export type Fetcher = (url: string, init: { headers: Record<string, string> }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
export interface Store { get(key: string): Promise<string | null>; put(key: string, value: string): Promise<void> }

export async function lookup(q: URLSearchParams, ip: string, token: string, store: Store, fetcher: Fetcher, now = Date.now()): Promise<{ status: number; body: unknown }> {
  if (!token) return { status: 503, body: { error: 'live photos are not set up here', photos: [] } };
  const headers = { Authorization: `OAuth ${token}`, 'User-Agent': 'ConquerCourse/1.0 (educational physics game)' };
  const ids = (q.get('id') ?? '').split(',').filter(Boolean);
  let key: string, run: () => Promise<Shown[]>, kind: 'id' | 'search';
  if (ids.length) {
    if (ids.length > 3 || ids.some((i) => !/^\d{5,20}$/.test(i))) return { status: 400, body: { error: 'ids: one to three photo numbers' } };
    kind = 'id'; key = `id:${[...ids].sort().join(',')}`;
    run = async () => {
      const out: Shown[] = [];
      for (const id of ids) {
        const r = await fetcher(`${GRAPH}/${id}?fields=${FIELDS}`, { headers });
        if (r.ok) { const t = trim((await r.json()) as Raw); if (t) out.push(t); }
      }
      return out;
    };
  } else {
    const lat = Number(q.get('lat')), lon = Number(q.get('lon')), r = Number(q.get('r') ?? 60);
    if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && r >= 10 && r <= 100)) return { status: 400, body: { error: 'lat, lon and r (10 to 100 m)' } };
    const dLat = r / 111320, dLon = r / (111320 * Math.cos((lat * Math.PI) / 180));
    kind = 'search'; key = `s:${lat.toFixed(4)},${lon.toFixed(4)},${Math.round(r)}`;
    run = async () => {
      const res = await fetcher(`${GRAPH}/images?bbox=${(lon - dLon).toFixed(6)},${(lat - dLat).toFixed(6)},${(lon + dLon).toFixed(6)},${(lat + dLat).toFixed(6)}&limit=200&fields=${FIELDS}`, { headers });
      if (!res.ok) throw new Error(`mapillary ${res.status}`);
      return (((await res.json()) as { data?: Raw[] }).data ?? []).map(trim).filter((t): t is Shown => !!t);
    };
  }
  const kept = await store.get(key);
  if (kept) return { status: 200, body: { photos: JSON.parse(kept), cache: 'hit' } };
  if (limited(`${kind}:${ip}`, now, LIMITS[kind])) return { status: 429, body: { error: 'slow down a little', photos: [] } };
  try {
    const photos = await run();
    await store.put(key, JSON.stringify(photos));
    return { status: 200, body: { photos, cache: 'miss' } };
  } catch { return { status: 502, body: { error: 'the photo service did not answer', photos: [] } }; }
}

export const onRequestGet = async ({ request, env, waitUntil }: { request: Request; env: { MAPILLARY_TOKEN?: string }; waitUntil?: (p: Promise<unknown>) => void }): Promise<Response> => {
  const cache = (globalThis as unknown as { caches?: { default: Cache } }).caches?.default;
  const store: Store = {
    async get(key) { if (!cache) return null; const hit = await cache.match(new Request(`https://photos.cache.invalid/${key}`)); return hit ? hit.text() : null; },
    async put(key, value) {
      if (!cache) return;
      const put = cache.put(new Request(`https://photos.cache.invalid/${key}`), new Response(value, { headers: { 'cache-control': `public, max-age=${TTL_S}` } }));
      if (waitUntil) waitUntil(put); else await put;
    },
  };
  const r = await lookup(new URL(request.url).searchParams, request.headers.get('cf-connecting-ip') ?? 'local', env.MAPILLARY_TOKEN ?? '', store, (u, i) => fetch(u, i), Date.now());
  return json(r.body, r.status);
};
