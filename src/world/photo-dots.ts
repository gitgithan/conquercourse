// Photo dots on the World slicer map (CC-133): a dot where each checked street photo was taken, and a small cone showing which way it faced.
// Pure helpers only; src/modes/map-photo-dots.ts draws them. Only photos on the per-place allow-lists are used (each was checked for people ahead of time).
import type { AllowedPhoto } from './live-photos';

export const DOTS_MAX = 200, DOTS_MIN_ZOOM = 15, CONE_M = 28, CONE_SPREAD_DEG = 22;
const M_LAT = 111320;

// The switch: ?photodots=1 on, ?photodots=0 off; with no word it is on while testing (this computer, the preview site) and off on the real site.
export const photoDotsOn = (params: URLSearchParams, host = typeof location === 'undefined' ? '' : location.hostname): boolean => {
  const w = params.get('photodots');
  if (w === '1') return true;
  if (w === '0') return false;
  return host === 'localhost' || host === '127.0.0.1' || host.startsWith('preview.');
};

// The cone: a thin fan from the photo's spot, centred on the compass angle (0 north, clockwise). Returned as a closed [lon, lat] ring.
export function coneRing(lat: number, lon: number, compass: number, lengthM = CONE_M, spreadDeg = CONE_SPREAD_DEG): [number, number][] {
  const at = (deg: number): [number, number] => {
    const r = (deg * Math.PI) / 180;
    return [lon + (lengthM * Math.sin(r)) / (M_LAT * Math.cos((lat * Math.PI) / 180)), lat + (lengthM * Math.cos(r)) / M_LAT];
  };
  const ring: [number, number][] = [[lon, lat]];
  for (let i = 0; i <= 4; i++) ring.push(at(compass - spreadDeg + (i * 2 * spreadDeg) / 4));
  ring.push([lon, lat]);
  return ring;
}

// The nearest `max` photos to a centre (ties by id, so the picture is steady).
export function nearest(list: AllowedPhoto[], lat: number, lon: number, max = DOTS_MAX): AllowedPhoto[] {
  const k = Math.cos((lat * Math.PI) / 180), d2 = (p: AllowedPhoto) => ((p.lon - lon) * k) ** 2 + (p.lat - lat) ** 2;
  return [...list].sort((a, b) => d2(a) - d2(b) || (a.id < b.id ? -1 : 1)).slice(0, max);
}

export interface Collection { type: 'FeatureCollection'; features: unknown[] }
export function dotsGeoJSON(list: AllowedPhoto[]): { dots: Collection; cones: Collection } {
  const dots: unknown[] = [], cones: unknown[] = [];
  for (const p of list) {
    dots.push({ type: 'Feature', properties: { id: p.id }, geometry: { type: 'Point', coordinates: [p.lon, p.lat] } });
    if (p.compass !== null) cones.push({ type: 'Feature', properties: { id: p.id }, geometry: { type: 'Polygon', coordinates: [coneRing(p.lat, p.lon, p.compass)] } });
  }
  return { dots: { type: 'FeatureCollection', features: dots }, cones: { type: 'FeatureCollection', features: cones } };
}
