// CC-234: where a place's buildings and street furniture stand behind the hero lane.
// The hero lane is one slice through the shrunk, centred city (src/slice/slice.ts); this file undoes that slice so the rest of the city can be drawn around it.
// Pure: no DOM, no network. Place metres are east (+x) and south (+z) of the pin; the game's x runs along the lane, y is up, z is across it (the camera looks from +z, so behind the lane is z below 0).
import type { Frame } from './furniture';
import type { SkinOsm, SkinElement } from './skin';

export interface UMapRun { u0: number; u1: number; x0: number }
export interface BackdropFrame {
  slug: string;
  k: number; // the shrink: place metres to game metres
  cx: number; cz: number; // the middle of the shrunk city that the editor moved to the origin (game metres)
  angle: number; offset: number; level: number; // the winning slice: its turn about the vertical rod (radians), sideways offset and height of the zero line (game metres)
  lowest: number; // the lowest ground of the place (real metres): buildings stand this much above y = 0
  shiftX: number; // game x minus the slice's u, averaged over the runs of ground
  uMap: UMapRun[];
  startX: number; finishX: number;
}

const M_LAT = 111320;
export const place2game = (b: BackdropFrame, east: number, south: number): { u: number; v: number } => {
  const px = east * b.k - b.cx, pz = south * b.k - b.cz, c = Math.cos(b.angle), s = Math.sin(b.angle);
  return { u: px * c + pz * s, v: -px * s + pz * c - b.offset };
};

// The exact map: along the lane the runs of ground sit where uMap says (the gaps between them are squeezed), so x is piecewise linear in u.
export function uToX(uMap: UMapRun[], u: number): number {
  if (!uMap.length) return u;
  const knots: [number, number][] = [];
  for (const r of uMap) knots.push([r.u0, r.x0], [r.u1, r.x0 + (r.u1 - r.u0)]);
  if (u <= knots[0][0]) return knots[0][1] + (u - knots[0][0]);
  for (let i = 0; i + 1 < knots.length; i++) if (u <= knots[i + 1][0]) { const [a, xa] = knots[i], [c, xc] = knots[i + 1]; return c === a ? xa : xa + ((u - a) / (c - a)) * (xc - xa); }
  const last = knots[knots.length - 1];
  return last[1] + (u - last[0]);
}

export function toCourse(b: BackdropFrame, east: number, south: number, ground: number): { x: number; y: number; z: number } {
  const { u, v } = place2game(b, east, south);
  return { x: uToX(b.uMap, u), y: (ground - b.lowest) * b.k - b.level, z: v };
}

// the same map as a rigid Frame, for src/world/furniture.ts toGame and for turning a three.js group (rotation about y by `rot`, then moving by tx, ty, tz)
export function rigidFrame(b: BackdropFrame): Frame {
  return { k: b.k, ox: b.cx, oz: b.cz, oy: b.lowest * b.k, rot: b.angle, tx: b.shiftX, ty: -b.level, tz: -b.offset, scale: 1, startX: b.startX, finishX: b.finishX };
}

// the shift that makes the rigid map agree best with the exact one: the mean of (x0 - u0) over the runs, weighted by their length
export const shiftOf = (uMap: UMapRun[]): number => { const w = uMap.reduce((t, r) => t + (r.u1 - r.u0), 0) || 1; return uMap.reduce((t, r) => t + (r.x0 - r.u0) * (r.u1 - r.u0), 0) / w; };

// how far the rigid map strays from the exact one over the lane (metres)
export function rigidError(b: BackdropFrame): number {
  let worst = 0;
  for (const r of b.uMap) for (const t of [0, 0.5, 1]) { const u = r.u0 + t * (r.u1 - r.u0); worst = Math.max(worst, Math.abs(uToX(b.uMap, u) - (u + b.shiftX))); }
  return worst;
}

const ringPoints = (e: SkinElement): { lat: number; lon: number }[][] => e.type === 'way' && e.geometry ? [e.geometry] : e.type === 'relation' ? (e.members ?? []).filter((m) => m.role === 'outer' && m.geometry).map((m) => m.geometry!) : [];

// Keep only what stands clear behind the lane and within `depth` of it, along the lane's length plus `reach` either side. Nothing near the run or between it and the camera stays.
export function behindLane(osm: SkinOsm, b: BackdropFrame, o: { gap?: number; depth?: number; reach?: number } = {}): SkinOsm {
  const gap = o.gap ?? 2, depth = o.depth ?? 60, reach = o.reach ?? 40, mLon = M_LAT * Math.cos((osm.lat * Math.PI) / 180);
  const x0 = Math.min(b.startX, ...b.uMap.map((r) => r.x0)) - reach, x1 = b.finishX + reach;
  const keep = (e: SkinElement): boolean => {
    if (!e.tags?.building) return false;
    const rs = ringPoints(e); if (!rs.length) return false;
    for (const r of rs) for (const p of r) {
      const { u, v } = place2game(b, (p.lon - osm.lon) * mLon, -(p.lat - osm.lat) * M_LAT), x = uToX(b.uMap, u);
      if (v > -gap || v < -depth || x < x0 || x > x1) return false;
    }
    return true;
  };
  return { ...osm, elements: osm.elements.filter(keep) };
}
