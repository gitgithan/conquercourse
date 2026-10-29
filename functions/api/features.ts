// /api/features?lat=48.8867&lon=2.3431&r=150: the street objects Mapillary's detectors found within r metres (30 to 300), for the street furniture of a real place (CC-187).
//   -> {features: [{id, value, lat, lon, seen}], cache: "hit" | "miss"}
// These are detections of objects (lamp posts, benches, signs), not photos, so no person is ever in the answer.
// Same pattern as /api/photos (CC-90): the token is the Pages secret MAPILLARY_TOKEN, sent in the Authorization header and never in an answer;
// only the five fields above come back, only the classes in WANTED are kept, answers are cached 30 minutes on the edge, and each address gets 20 searches per ten minutes.
import { limited, type Fetcher, type Store } from './photos';

const GRAPH = 'https://graph.mapillary.com';
export const TTL_S = 1800;
export const SEARCH_LIMIT = 20;
// Mapillary class -> what the game draws. The class names were counted on 29 real places (data/eval/cc-furniture/README.md); there is no bollard class in the answer.
export const WANTED: Record<string, string> = {
  'object--street-light': 'light', 'object--bench': 'bench', 'object--trash-can': 'bin', 'object--traffic-sign--front': 'sign',
  'object--traffic-light--general-upright-front': 'signal', 'object--traffic-light--general-upright-side': 'signal', 'object--traffic-light--pedestrians-front': 'signal', 'object--traffic-light--pedestrians-side': 'signal',
  'object--support--pole': 'pole', 'object--support--utility-pole': 'pole', 'marking--discrete--crosswalk-zebra': 'crosswalk',
};
export interface Feature { id: string; value: string; lat: number; lon: number; seen: string }
interface Raw { id?: string; object_value?: string; geometry?: { type?: string; coordinates?: number[] }; last_seen_at?: string }

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });

export const trimFeature = (r: Raw): Feature | null => {
  const c = r.geometry?.type === 'Point' ? r.geometry.coordinates : undefined;
  if (!r.id || !/^\d{5,20}$/.test(r.id) || !r.object_value || !(r.object_value in WANTED) || !c || c.length < 2 || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) return null;
  return { id: r.id, value: r.object_value, lat: Math.round(c[1] * 1e7) / 1e7, lon: Math.round(c[0] * 1e7) / 1e7, seen: String(r.last_seen_at ?? '').slice(0, 10) };
};

export async function lookupFeatures(q: URLSearchParams, ip: string, token: string, store: Store, fetcher: Fetcher, now = Date.now()): Promise<{ status: number; body: unknown }> {
  if (!token) return { status: 503, body: { error: 'street objects are not set up here', features: [] } };
  const lat = Number(q.get('lat')), lon = Number(q.get('lon')), r = Number(q.get('r') ?? 150);
  if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && r >= 30 && r <= 300)) return { status: 400, body: { error: 'lat, lon and r (30 to 300 m)' } };
  const dLat = r / 111320, dLon = r / (111320 * Math.cos((lat * Math.PI) / 180));
  const key = `f:${lat.toFixed(4)},${lon.toFixed(4)},${Math.round(r)}`;
  const kept = await store.get(key);
  if (kept) return { status: 200, body: { features: JSON.parse(kept), cache: 'hit' } };
  if (limited(`features:${ip}`, now, SEARCH_LIMIT)) return { status: 429, body: { error: 'slow down a little', features: [] } };
  const headers = { Authorization: `OAuth ${token}`, 'User-Agent': 'ConquerCourse/1.0 (educational physics game)' };
  try {
    const res = await fetcher(`${GRAPH}/map_features?bbox=${(lon - dLon).toFixed(6)},${(lat - dLat).toFixed(6)},${(lon + dLon).toFixed(6)},${(lat + dLat).toFixed(6)}&limit=2000&fields=id,object_value,geometry,last_seen_at`, { headers });
    if (!res.ok) throw new Error(`mapillary ${res.status}`);
    const features = (((await res.json()) as { data?: Raw[] }).data ?? []).map(trimFeature).filter((f): f is Feature => !!f);
    await store.put(key, JSON.stringify(features));
    return { status: 200, body: { features, cache: 'miss' } };
  } catch { return { status: 502, body: { error: 'the street object service did not answer', features: [] } }; }
}

export const onRequestGet = async ({ request, env, waitUntil }: { request: Request; env: { MAPILLARY_TOKEN?: string }; waitUntil?: (p: Promise<unknown>) => void }): Promise<Response> => {
  const cache = (globalThis as unknown as { caches?: { default: Cache } }).caches?.default;
  const store: Store = {
    async get(key) { if (!cache) return null; const hit = await cache.match(new Request(`https://features.cache.invalid/${key}`)); return hit ? hit.text() : null; },
    async put(key, value) {
      if (!cache) return;
      const put = cache.put(new Request(`https://features.cache.invalid/${key}`), new Response(value, { headers: { 'cache-control': `public, max-age=${TTL_S}` } }));
      if (waitUntil) waitUntil(put); else await put;
    },
  };
  const r = await lookupFeatures(new URL(request.url).searchParams, request.headers.get('cf-connecting-ip') ?? 'local', env.MAPILLARY_TOKEN ?? '', store, (u, i) => fetch(u, i), Date.now());
  return json(r.body, r.status);
};
