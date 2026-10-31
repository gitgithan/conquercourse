// CC-90: does a lane have street photos along the way? A plain-words answer for the Course and for the Map result panel.
// It only reads the offline allow-lists (public/assets/photos-live), so a person never sees an unfiltered picture; there is no live lookup here.
import { pickPhotos, type AllowList, type PlaceLine } from './live-photos';

export type PhotoLevel = 'whole' | 'part' | 'none';
export const STEP_M = 10; // the lane is checked every 10 real metres
export const WHOLE_SHARE = 0.9; // "along your whole lane": at least nine in ten checked spots have a photo that faces them

export const levelWords: Record<PhotoLevel, string> = {
  whole: 'Street photos: along your whole lane',
  part: 'Street photos: along part of it',
  none: 'Street photos: none here yet',
};
export const NOT_PREPARED = 'Street photos are only prepared for the places in the list.';

/** The share (0 to 1) of spots along the lane, one every 10 real metres, where at least one allowed photo is near and faces the spot. Real map metres: the size of the game course does not matter. */
export function laneShare(list: AllowList | null | undefined, place: PlaceLine): number {
  if (!list?.photos.length) return 0;
  const [x0, y0, x1, y1] = place.lane.line, len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.floor(len / STEP_M) + 1);
  let hit = 0;
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1), spot = { x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k };
    if (pickPhotos(list.photos, place, spot, 1).length) hit++;
  }
  return hit / n;
}
export const levelOf = (share: number): PhotoLevel => (share >= WHOLE_SHARE ? 'whole' : share > 0 ? 'part' : 'none');

export interface Prepared { slug: string; name: string; lat: number; lon: number; list: AllowList | null }

/** The status of a lane (a prepared place's own lane, or a custom slice's lane) from the prepared places' allow-lists; `near` is the closest prepared place with a list. */
export function photoStatus(place: PlaceLine, prepared: Prepared[]): { level: PhotoLevel; share: number; text: string; nearest: Prepared | null } {
  const withList = prepared.filter((p) => p.list?.photos.length);
  const m = (p: Prepared) => Math.hypot((p.lon - place.lon) * 111320 * Math.cos((place.lat * Math.PI) / 180), (p.lat - place.lat) * 111320);
  const nearest = [...withList].sort((a, b) => m(a) - m(b))[0] ?? null;
  // only lists within 400 m can have photos near this lane (a list holds photos within about 70 m of its own lane)
  let share = 0;
  for (const p of withList) if (m(p) < 400) share = Math.max(share, laneShare(p.list, place));
  const level = levelOf(share);
  return { level, share, text: level === 'none' ? NOT_PREPARED : levelWords[level], nearest };
}
