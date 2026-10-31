// Street photos along a lane (CC-90): which already-checked photos can be seen from a line, and how much of the line they cover.
// Pure helpers: the pictures themselves are fetched by src/ui/street-panel.ts. Only photos in the per-place allow-list are ever used (each was checked for people ahead of time).
import { pickPhotos, type AllowedPhoto, type PlaceLine, type Spot } from './live-photos';
import { toXY } from './live-photos';

export const streetPhotosOn = (params: URLSearchParams): boolean => params.get('streetphotos') !== '0'; // ?streetphotos=0 turns the panel and the chips off
export const SAMPLE_M = 10, MAX_THUMBS = 6;
export type Coverage = 'whole' | 'part' | 'none';
export interface LanePhoto { photo: AllowedPhoto; alongM: number; offM: number } // alongM: how far along the lane the photo looks at; offM: how far the camera stood from that spot
export interface LaneView { coverage: Coverage; share: number; photos: LanePhoto[]; lengthM: number }

// Walk the line (metres east and south of the pin) in SAMPLE_M steps; at each step take the photos that face it.
export function lanePhotos(list: AllowedPhoto[], place: { lat: number; lon: number }, line: [number, number, number, number]): LaneView {
  const [x0, y0, x1, y1] = line, lengthM = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(lengthM / SAMPLE_M));
  const pl: PlaceLine = { lat: place.lat, lon: place.lon, lane: { line } }, best = new Map<string, LanePhoto>();
  let covered = 0;
  for (let i = 0; i <= n; i++) {
    const spot: Spot = { x: x0 + ((x1 - x0) * i) / n, y: y0 + ((y1 - y0) * i) / n };
    const got = pickPhotos(list, pl, spot, 3);
    if (got.length) covered++;
    for (const p of got) {
      const at = toXY(place.lat, place.lon, p.lat, p.lon), off = Math.hypot(at.x - spot.x, at.y - spot.y), have = best.get(p.id);
      if (!have || off < have.offM) best.set(p.id, { photo: p, alongM: (lengthM * i) / n, offM: off });
    }
  }
  const share = covered / (n + 1), coverage: Coverage = share >= 0.8 ? 'whole' : covered > 0 ? 'part' : 'none';
  return { coverage, share, lengthM, photos: [...best.values()].sort((a, b) => a.alongM - b.alongM || (a.photo.id < b.photo.id ? -1 : 1)) };
}

// Spread the few thumbnails along the lane: at most `max`, evenly through the sorted list.
export function spread<T>(xs: T[], max = MAX_THUMBS): T[] {
  if (xs.length <= max) return xs;
  return Array.from({ length: max }, (_, i) => xs[Math.round((i * (xs.length - 1)) / (max - 1))]);
}

export const coverageLine = (v: LaneView | null, hasList: boolean): string =>
  !hasList ? 'No street photos for this place yet. Every photo is checked for people ahead of time, so only some places have them, and a place you cut yourself has none.'
  : !v || v.coverage === 'none' ? 'Street photos: none here yet along this line. Move the line toward a street to see some.'
  : v.coverage === 'whole' ? `Street photos along your whole lane (${v.photos.length} to choose from).`
  : `Street photos along part of your lane (${Math.round(v.share * 100)}% of it, ${v.photos.length} to choose from).`;

// The places that have street photos (the small index next to the allow-lists). Empty when the switch is off or the file is missing.
let placesWithPhotos: Promise<Set<string>> | null = null;
export const loadStreetPlaces = (params: URLSearchParams, f: typeof fetch = fetch): Promise<Set<string>> => {
  if (!streetPhotosOn(params)) return Promise.resolve(new Set());
  placesWithPhotos ??= f('/assets/photos-live/index.json').then((r) => (r.ok ? r.json() : { places: {} })).then((j: { places?: Record<string, number> }) => new Set(Object.keys(j.places ?? {}))).catch(() => new Set<string>());
  return placesWithPhotos;
};
export const STREET_CHIP = 'Street photos';
export const STREET_CHIP_TITLE = 'Real street photos of this place are shown along the lane';
