// Places (CC-78): one question to the public map servers, asked the way that works.
// The three servers the map mode used to try one after another were often down, slow or refusing (see docs/world-slice.md, "Dropping a pin").
// Now every server is asked at the same time and the first good answer wins; the site's own /api/places keeps each answer.
// Pure: the caller passes the fetcher, so the Pages Function, the dev server, the build script and the browser all share this.
import type { OverpassAnswer } from './osm';

export const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
// the main server answers 406 to the default user agents of tools; a polite, named one is asked for by its usage policy
export const USER_AGENT = 'ConquerCourse/1.0 (a physics game for the Meta hackathon; one query per place; contact via the project site)';

export const MIN_RADIUS = 60, MAX_RADIUS = 300;
export const MAX_ELEMENTS = 4000; // a city centre block, not a district

export const buildingsQuery = (lat: number, lon: number, radius: number, timeout = 25) =>
  `[out:json][timeout:${timeout}];(way["building"](around:${radius},${lat},${lon});relation["building"](around:${radius},${lat},${lon}););out geom tags;`;

export interface PlaceRequest { lat: number; lon: number; radius: number }

// Rounded so that two pins a few metres apart share one answer (about 11 m).
export function placeKey(r: PlaceRequest): string {
  return `${r.lat.toFixed(4)},${r.lon.toFixed(4)},${Math.round(r.radius / 10) * 10}`;
}

export function parseRequest(q: URLSearchParams): PlaceRequest | string {
  const lat = Number(q.get('lat')), lon = Number(q.get('lon')), radius = Number(q.get('r') ?? 120);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(radius)) return 'give lat, lon and r';
  if (Math.abs(lat) > 85 || Math.abs(lon) > 180) return 'that is not on the map';
  if (radius < MIN_RADIUS || radius > MAX_RADIUS) return `r must be ${MIN_RADIUS} to ${MAX_RADIUS} metres`;
  return { lat: Math.round(lat * 1e4) / 1e4, lon: Math.round(lon * 1e4) / 1e4, radius: Math.round(radius / 10) * 10 };
}

// Keep only what the buildings need (the answer is cached and sent to every browser): the three tags and geometry to 6 decimals.
export function trimAnswer(j: OverpassAnswer): OverpassAnswer {
  const keep = ['building', 'height', 'building:levels'];
  const round = (p: { lat: number; lon: number }) => ({ lat: Math.round(p.lat * 1e6) / 1e6, lon: Math.round(p.lon * 1e6) / 1e6 });
  const elements = (j.elements ?? []).slice(0, MAX_ELEMENTS).map((e) => {
    const tags = e.tags ? Object.fromEntries(Object.entries(e.tags).filter(([k]) => keep.includes(k))) : undefined;
    if (e.type === 'way') return { type: 'way' as const, ...(tags ? { tags } : {}), geometry: (e.geometry ?? []).map(round) };
    return { type: 'relation' as const, ...(tags ? { tags } : {}), members: (e.members ?? []).filter((m) => m.type === 'way' && m.role === 'outer').map((m) => ({ type: m.type, role: m.role, geometry: (m.geometry ?? []).map(round) })) };
  });
  return { elements };
}

export interface MirrorAnswer { answer: OverpassAnswer; mirror: string; ms: number; tried: number }

// Ask every mirror at once. The first answer that is a real Overpass answer wins and the others are cancelled.
export async function askMirrors(
  r: PlaceRequest,
  opts: { fetcher?: typeof fetch; mirrors?: string[]; timeoutMs?: number; signal?: AbortSignal; userAgent?: boolean; queryTimeout?: number } = {},
): Promise<MirrorAnswer> {
  const fetcher = opts.fetcher ?? fetch, mirrors = opts.mirrors ?? OVERPASS_MIRRORS, timeoutMs = opts.timeoutMs ?? 20000;
  const t0 = Date.now();
  const stops: AbortController[] = [];
  const body = 'data=' + encodeURIComponent(buildingsQuery(r.lat, r.lon, r.radius, opts.queryTimeout));
  const tries = mirrors.map(async (url) => {
    const stop = new AbortController(); stops.push(stop);
    const timer = setTimeout(() => stop.abort(), timeoutMs);
    opts.signal?.addEventListener('abort', () => stop.abort(), { once: true });
    try {
      // the browser may not set User-Agent; the servers accept it without one when the request comes from a page
      const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' };
      if (opts.userAgent !== false) headers['User-Agent'] = USER_AGENT;
      const res = await fetcher(url, { method: 'POST', headers, body, signal: stop.signal });
      if (!res.ok) throw new Error(`${new URL(url).host}: HTTP ${res.status}`);
      const j = (await res.json()) as OverpassAnswer & { remark?: string };
      if (!Array.isArray(j.elements)) throw new Error(`${new URL(url).host}: not an answer`);
      if (!j.elements.length && j.remark) throw new Error(`${new URL(url).host}: ${j.remark.slice(0, 60)}`); // "runtime error: Query timed out"
      return { answer: trimAnswer(j), mirror: new URL(url).host, ms: Date.now() - t0, tried: mirrors.length };
    } finally { clearTimeout(timer); }
  });
  try {
    return await Promise.any(tries);
  } catch (e) {
    const errs = (e as AggregateError).errors?.map((x: Error) => x.message).join('; ') ?? String(e);
    throw new Error(`no map server answered (${errs.slice(0, 300)})`);
  } finally { for (const s of stops) s.abort(); }
}

// ---- ready places: built once, shipped as files, load at once
export interface ReadyIndexEntry { slug: string; name: string; lat: number; lon: number; radius: number; hill_m: number; buildings: number; bytes: number; blurb: string; listed?: boolean; path?: boolean; photos?: number }
// CC-178: the list shows only places with a lane found by default AND street photos the game may show (listed is set by scripts/places-list.ts); ?places=all shows every place.
export const shownReady = (index: ReadyIndexEntry[], all: boolean, proven = false): ReadyIndexEntry[] => (proven ? index.filter((p) => p.path === true) : index).filter((p) => all || p.listed !== false);
/** CC-211: a ready place has a path when the simulator cleared the lane stored with it (`path` in the index, written from the place file by scripts/places-list.ts). */
export const hasPath = (p: ReadyIndexEntry): boolean => p.path === true;
export interface PlaceLane {
  shrink: number; lengthM: number; levelM: number; turnDeg: number; sidewaysM: number;
  steps: number; faces: number; gaps: number; curves: number; maxDropM: number; cleared: boolean; secondsTaken: number;
  line: [number, number, number, number]; widthM: number; // the lane's two ends (x east, z south, in real metres from the pin) and its real width
  roles: { footprint: number; role: 'deck' | 'step' | 'wall' | 'gap-edge' }[]; // footprint = index into buildingsFrom(answer), in the order they are listed
}
export interface ReadyPlace { slug: string; name: string; lat: number; lon: number; radius: number; blurb: string; answer: OverpassAnswer; ground: { step: number; n: number; h: number[] } | null; lane: PlaceLane | null }

// Which ready place is within `metres` of a pin (the nearest one), if any.
export function nearestReady(index: ReadyIndexEntry[], lat: number, lon: number, metres = 300): ReadyIndexEntry | null {
  const mLat = 111320, mLon = 111320 * Math.cos((lat * Math.PI) / 180);
  let best: ReadyIndexEntry | null = null, bd = Infinity;
  for (const p of index) { const d = Math.hypot((p.lon - lon) * mLon, (p.lat - lat) * mLat); if (d <= metres && d < bd) { bd = d; best = p; } }
  return best;
}
