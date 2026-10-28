// Live nearby photos (CC-90): as the runner moves along a real place, the strip shows street photos taken near that spot.
// Only photos on a per-place allow-list are ever shown: scripts/photos_people.py made the list offline and left out every photo with a person in it,
// so a player never meets an unfiltered picture. The network is used only to turn an allowed photo id into a fresh picture address (they expire).
import type { PhotoCredit, PlacePhotos } from '../ui/place-photos';

export interface PlaceLine { lat: number; lon: number; lane: { line: [number, number, number, number] } } // line: metres east and south of the pin (src/world/osm.ts)
export interface AllowedPhoto { id: string; creator: string; capturedAt: number | null; lat: number; lon: number; compass: number | null }
export interface AllowList { place: string; name: string; generated: string; source: string; photos: AllowedPhoto[] }
export interface Spot { x: number; y: number } // metres east and south of the pin
export interface Thumb { id: string; thumb: string; creator: string; capturedAt: number | null }

export const NEAR_M = 60, FACE_DEG = 60, MAX_SHOWN = 3, CELL_M = 20, MIN_MS = 2000, MIN_MOVE_M = 15;
const M_LAT = 111320;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

export const toXY = (lat0: number, lon0: number, lat: number, lon: number): Spot => ({ x: (lon - lon0) * M_LAT * Math.cos((lat0 * Math.PI) / 180), y: -(lat - lat0) * M_LAT });
export const toLatLon = (lat0: number, lon0: number, s: Spot): { lat: number; lon: number } => ({ lat: lat0 - s.y / M_LAT, lon: lon0 + s.x / (M_LAT * Math.cos((lat0 * Math.PI) / 180)) });

// How far along the lane the runner is (0 to 1): the course runs start to finish along the place's lane line.
export const progressOf = (course: { startX: number; finishX: number }, x: number): number => clamp01((x - course.startX) / Math.max(1e-6, course.finishX - course.startX));
export function spotAt(place: PlaceLine, t: number): Spot {
  const [x0, y0, x1, y1] = place.lane.line, k = clamp01(t);
  return { x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k };
}

export const bearing = (a: Spot, b: Spot): number => ((Math.atan2(b.x - a.x, -(b.y - a.y)) * 180) / Math.PI + 360) % 360; // compass degrees, 0 north, y is south
export const angDiff = (a: number, b: number): number => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };

// The allowed photos within NEAR_M of the spot whose camera points toward it, nearest first (a photo with no direction is not used).
export function pickPhotos(list: AllowedPhoto[], place: PlaceLine, spot: Spot, max = MAX_SHOWN): AllowedPhoto[] {
  const scored: { p: AllowedPhoto; d: number }[] = [];
  for (const p of list) {
    if (p.compass === null) continue;
    const at = toXY(place.lat, place.lon, p.lat, p.lon), d = Math.hypot(at.x - spot.x, at.y - spot.y);
    if (d <= NEAR_M && angDiff(p.compass, bearing(at, spot)) <= FACE_DEG) scored.push({ p, d });
  }
  return scored.sort((a, b) => a.d - b.d || (a.p.id < b.p.id ? -1 : 1)).slice(0, max).map((s) => s.p);
}

export const cellKey = (s: Spot, size = CELL_M): string => `${Math.floor(s.x / size)},${Math.floor(s.y / size)}`;

// At most one new lookup per MIN_MS and per MIN_MOVE_M of travel: both must have passed.
export class Throttle {
  private at = -Infinity; private last: Spot | null = null;
  constructor(private minMs = MIN_MS, private minM = MIN_MOVE_M) {}
  ready(now: number, s: Spot): boolean {
    if (this.last && (now - this.at < this.minMs || Math.hypot(s.x - this.last.x, s.y - this.last.y) < this.minM)) return false;
    this.at = now; this.last = s; return true;
  }
}

export const photoPage = (id: string): string => `https://www.mapillary.com/app/?pKey=${id}`;
export const LICENCE = { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' };

export function creditFor(a: AllowedPhoto, t: Thumb, near: number): PhotoCredit {
  const year = t.capturedAt ? new Date(t.capturedAt).getUTCFullYear() : null;
  return {
    file: t.thumb, title: `Mapillary photo ${a.id}`, author: t.creator || a.creator || 'a Mapillary contributor', licence: LICENCE.name, licenceUrl: LICENCE.url,
    source: photoPage(a.id), date: year ? String(year) : '', hint: `A street photo taken about ${Math.max(1, Math.round(near))} m from the runner${year ? `, ${year}` : ''}.`,
    changes: 'Shown at a smaller size by the game.', width: 1024, height: 768, bytes: 0,
  };
}

export interface LiveOpts {
  place: PlaceLine; allow: AllowList; course: { startX: number; finishX: number };
  resolve: (ids: string[]) => Promise<Thumb[] | null>; // null: the lookup failed, so the stored photos are used
  show: (d: PlacePhotos | null) => void; // null: no live photo here
  now?: () => number;
}

// update(x) is called every frame with the runner's x; it does the work at most once per throttle step and per 20 m cell.
export function createLive(o: LiveOpts) {
  const now = o.now ?? (() => Date.now()), throttle = new Throttle(), picks = new Map<string, AllowedPhoto[]>(), thumbs = new Map<string, Thumb>();
  let shown = '', busy = false;
  async function update(x: number): Promise<void> {
    const spot = spotAt(o.place, progressOf(o.course, x));
    if (busy || !throttle.ready(now(), spot)) return;
    const key = cellKey(spot);
    let chosen = picks.get(key);
    if (!chosen) { chosen = pickPhotos(o.allow.photos, o.place, spot); picks.set(key, chosen); }
    const sig = chosen.map((p) => p.id).join(',');
    if (sig === shown) return;
    busy = true;
    try {
      if (!chosen.length) { shown = sig; o.show(null); return; }
      const missing = chosen.filter((p) => !thumbs.has(p.id)).map((p) => p.id);
      if (missing.length) {
        const got = await o.resolve(missing);
        if (!got) { o.show(null); return; } // not remembered as shown: the next step tries again
        for (const t of got) thumbs.set(t.id, t);
      }
      const ready = chosen.filter((p) => thumbs.has(p.id));
      shown = sig;
      if (!ready.length) { o.show(null); return; }
      const near = (p: AllowedPhoto) => { const s = toXY(o.place.lat, o.place.lon, p.lat, p.lon); return Math.hypot(s.x - spot.x, s.y - spot.y); };
      o.show({ place: o.allow.place, name: o.allow.name, photos: ready.map((p) => creditFor(p, thumbs.get(p.id)!, near(p))), note: 'Street photos from Mapillary contributors, CC BY-SA 4.0. Click one to see it large.' });
    } finally { busy = false; }
  }
  return { update, picksCached: () => picks.size };
}
