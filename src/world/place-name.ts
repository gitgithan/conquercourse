// A short name for the place the player picked (CC-90): shown at the top of the Slicer panel so a player who scrolls away or comes back remembers where they are.
// Pure functions, so the page and the tests share them. A ready place keeps its own name; any other place gets the best short name the map's address gives.
import { nearestReady, type ReadyIndexEntry } from './places';

export const MAX_NAME = 28;
export interface Address { name?: string; amenity?: string; tourism?: string; historic?: string; leisure?: string; building?: string; neighbourhood?: string; quarter?: string; suburb?: string; city_district?: string; road?: string; pedestrian?: string; city?: string; town?: string; village?: string; municipality?: string }

const clip = (s: string): string => (s.length <= MAX_NAME ? s : `${s.slice(0, MAX_NAME - 1).trimEnd()}…`);

/** The first part of a long search result ("Piazza San Marco, San Marco, Venezia, Veneto, Italia" becomes "Piazza San Marco"). */
export const shortFromSearch = (displayName: string): string => clip(displayName.split(',')[0].trim() || displayName.trim());

/** Best short name from an address: the place's own name, else its quarter, else its street; the town is added when it fits. */
export function shortFromAddress(a: Address, own?: string): string {
  const base = (own ?? a.name ?? a.tourism ?? a.historic ?? a.leisure ?? a.amenity ?? a.neighbourhood ?? a.quarter ?? a.suburb ?? a.city_district ?? a.pedestrian ?? a.road ?? '').trim();
  const town = (a.city ?? a.town ?? a.village ?? a.municipality ?? '').replace(/^(Greater|City of) /, '').trim();
  if (!base) return town ? clip(town) : '';
  if (town && town !== base && `${base}, ${town}`.length <= MAX_NAME) return `${base}, ${town}`;
  return clip(base);
}

/** What to call a pin: a ready place within 300 m by its own name, else the search hit's short name, else the pin's place on the map. */
export const nameFor = (lat: number, lon: number, ready: ReadyIndexEntry[], hint?: string): string | null => {
  const r = nearestReady(ready, lat, lon, 300);
  return r ? r.name : hint ? shortFromSearch(hint) : null;
};
export const pinLabel = (lat: number, lon: number): string => `Pin ${lat.toFixed(3)}, ${lon.toFixed(3)}`;
