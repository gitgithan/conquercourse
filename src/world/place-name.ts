// A short name for the place the player picked (CC-90): shown at the top of the Slicer panel so a player who scrolls away or comes back remembers where they are.
// Pure functions, so the page and the tests share them. A ready place keeps its own name; any other place gets the best short name the map's address gives.
import { nearestReady, type ReadyIndexEntry } from './places';

export const MAX_NAME = 28;
export interface Address { country_code?: string; name?: string; amenity?: string; tourism?: string; historic?: string; leisure?: string; building?: string; neighbourhood?: string; quarter?: string; suburb?: string; city_district?: string; road?: string; pedestrian?: string; city?: string; town?: string; village?: string; municipality?: string }

const clip = (s: string, n = MAX_NAME): string => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);
const tag = (cc?: string): string => (cc && /^[a-z]{2}$/i.test(cc) ? ` (${cc.toUpperCase()})` : ''); // the country code tells apart places that share a name

/** The first part of a long search result, with the country code ("Piazza San Marco, San Marco, Venezia, Italia" becomes "Piazza San Marco (IT)"). */
export const shortFromSearch = (displayName: string, cc?: string): string => { const t = tag(cc); return clip(displayName.split(',')[0].trim() || displayName.trim(), MAX_NAME - t.length) + t; };

/** Best short name from an address: the place's own name, else its quarter, else its street; the town is added when it fits; the country code always. */
export function shortFromAddress(a: Address, own?: string): string {
  const base = (own ?? a.name ?? a.tourism ?? a.historic ?? a.leisure ?? a.amenity ?? a.neighbourhood ?? a.quarter ?? a.suburb ?? a.city_district ?? a.pedestrian ?? a.road ?? '').trim();
  const town = (a.city ?? a.town ?? a.village ?? a.municipality ?? '').replace(/^(Greater|City of) /, '').trim(), t = tag(a.country_code), room = MAX_NAME - t.length;
  if (!base) return town ? clip(town, room) + t : '';
  if (town && town !== base && `${base}, ${town}`.length <= room) return `${base}, ${town}${t}`;
  return clip(base, room) + t;
}

/** What to call a pin: a ready place within 300 m by its own name, else the search hit's short name, else the pin's place on the map. */
export const nameFor = (lat: number, lon: number, ready: ReadyIndexEntry[], hint?: string, cc?: string): string | null => {
  const r = nearestReady(ready, lat, lon, 300);
  return r ? r.name : hint ? shortFromSearch(hint, cc) : null;
};
export const pinLabel = (lat: number, lon: number): string => `Pin ${lat.toFixed(3)}, ${lon.toFixed(3)}`;
