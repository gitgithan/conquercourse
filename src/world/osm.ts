// OpenStreetMap buildings (an Overpass answer) become one mesh of extruded blocks (CC-48, from the CC-46 spike).
// Pure: no DOM, no network. With a `Ground` (CC-51) each building stands on the real hill, shrunk like the rest. Metres, y up, east is +x, south is +z, standing on y = 0, centred on the pin.
import { groundAt, lowest, relief, type Ground } from './terrain';
export interface OsmWay { type: 'way'; tags?: Record<string, string>; geometry?: { lat: number; lon: number }[] }
export interface OsmRelation { type: 'relation'; tags?: Record<string, string>; members?: { type: string; role: string; geometry?: { lat: number; lon: number }[] }[] }
export interface OverpassAnswer { elements: (OsmWay | OsmRelation)[] }
export interface Building { ring: [number, number][]; h: number; real: boolean }
export interface OsmMesh { positions: number[]; indices: number[]; buildings: number; withRealHeight: number; medianHeight: number; shrink: number; relief: number }

export const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
export const overpassQuery = (lat: number, lon: number, radius: number) => `[out:json][timeout:40];(way["building"](around:${radius},${lat},${lon});relation["building"](around:${radius},${lat},${lon}););out geom tags;`;

const num = (s?: string) => { const v = parseFloat((s ?? '').replace(',', '.')); return Number.isFinite(v) ? v : null; };
// a height tag, else levels x 3 m, else a guess of 9 m
export function heightOf(tags: Record<string, string> = {}): { h: number; real: boolean } {
  const h = num(tags.height); if (h !== null && h > 0) return { h, real: true };
  const l = num(tags['building:levels']); if (l !== null && l > 0) return { h: l * 3, real: true };
  return { h: 9, real: false };
}

export function buildingsFrom(osm: OverpassAnswer, lat: number, lon: number): Building[] {
  const mPerDegLat = 111320, mPerDegLon = 111320 * Math.cos((lat * Math.PI) / 180);
  const toM = (p: { lat: number; lon: number }): [number, number] => [(p.lon - lon) * mPerDegLon, -(p.lat - lat) * mPerDegLat];
  const out: Building[] = [];
  for (const e of osm.elements ?? []) {
    const { h, real } = heightOf(e.tags);
    if (e.type === 'way' && e.geometry) out.push({ ring: e.geometry.map(toM), h, real });
    else if (e.type === 'relation') for (const m of e.members ?? []) if (m.type === 'way' && m.role === 'outer' && m.geometry && m.geometry.length > 3) out.push({ ring: m.geometry.map(toM), h, real }); // courtyards are ignored
  }
  return out;
}

export const medianHeight = (bs: Building[]) => { const hs = bs.map((b) => b.h).sort((a, b) => a - b); return hs[Math.floor(hs.length / 2)] ?? 9; };
// the spike's start: a typical building about 5 m tall once shrunk
export const suggestedShrink = (bs: Building[]) => Math.min(1, Math.max(0.02, 5 / medianHeight(bs)));
export const MAX_SHRUNK_HEIGHT = 8; // no building taller than 8 m once shrunk (a runner jumps at most 0.9 m up, so tops still step)

const area2 = (p: [number, number][]) => p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0);
// ear clipping: triangles as index triples; the polygon must be counter-clockwise (area2 > 0)
export function earClip(p: [number, number][]): number[][] {
  const idx = p.map((_, i) => i), tris: number[][] = [];
  const cross = (a: number[], b: number[], c: number[]) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  let guard = 0;
  while (idx.length > 3 && guard++ < 5000) {
    let cut = false;
    for (let k = 0; k < idx.length; k++) {
      const ia = idx[(k + idx.length - 1) % idx.length], ib = idx[k], ic = idx[(k + 1) % idx.length];
      const a = p[ia], b = p[ib], c = p[ic];
      if (cross(a, b, c) <= 1e-9) continue;
      if (idx.some((i) => i !== ia && i !== ib && i !== ic && cross(a, b, p[i]) >= 0 && cross(b, c, p[i]) >= 0 && cross(c, a, p[i]) >= 0)) continue;
      tris.push([ia, ib, ic]); idx.splice(k, 1); cut = true; break;
    }
    if (!cut) { for (let k = 1; k + 1 < idx.length; k++) tris.push([idx[0], idx[k], idx[k + 1]]); return tris; } // degenerate: fan
  }
  if (idx.length === 3) tris.push([idx[0], idx[1], idx[2]]);
  return tris;
}

// Walls plus a flat roof per building, shrunk by k; heights are capped so they are at most MAX_SHRUNK_HEIGHT after the shrink.
// With a ground, the lowest point of the place is y = 0 and each building's walls run from there up to its roof,
// which sits its own (shrunk) height above the ground at its middle: a hill becomes steps from roof to roof.
export function extrude(bs: Building[], k: number, ground?: Ground | null): { positions: number[]; indices: number[] } {
  const positions: number[] = [], indices: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[]) => { const o = positions.length / 3; for (const v of [a, b, c, d]) positions.push(...v); indices.push(o, o + 1, o + 2, o, o + 2, o + 3); };
  for (const b of bs) {
    let ring = b.ring.slice(); if (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) ring.pop();
    if (ring.length < 3 || Math.abs(area2(ring)) < 4) continue;
    if (area2(ring) < 0) ring = ring.reverse();
    const cx = ring.reduce((t, p) => t + p[0], 0) / ring.length, cz = ring.reduce((t, p) => t + p[1], 0) / ring.length;
    const y1 = (ground ? (groundAt(ground, cx, cz) - lowest(ground)) * k : 0) + Math.min(b.h * k, MAX_SHRUNK_HEIGHT);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], c = ring[(i + 1) % ring.length];
      quad([a[0] * k, 0, a[1] * k], [a[0] * k, y1, a[1] * k], [c[0] * k, y1, c[1] * k], [c[0] * k, 0, c[1] * k]);
    }
    const o = positions.length / 3;
    for (const p of ring) positions.push(p[0] * k, y1, p[1] * k);
    for (const t of earClip(ring)) indices.push(o + t[0], o + t[2], o + t[1]); // wound so the roof faces up
  }
  return { positions, indices };
}

export function osmToMesh(osm: OverpassAnswer, lat: number, lon: number, shrink?: number, ground?: Ground | null): OsmMesh {
  const bs = buildingsFrom(osm, lat, lon);
  const k = shrink ?? suggestedShrink(bs);
  const m = extrude(bs, k, ground);
  return { ...m, buildings: bs.length, withRealHeight: bs.filter((b) => b.real).length, medianHeight: medianHeight(bs), shrink: k, relief: relief(ground) * k };
}
