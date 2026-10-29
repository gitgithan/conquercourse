// Street furniture along a real place's lane (CC-187): where each object from Mapillary's map_features sits in the game's frame, and how it is kept off the run.
// Pure maths and data only (src/render/furniture-view.ts draws it); nothing here touches the physics, the lane or the course file.
export const KINDS = ['light', 'bench', 'bin', 'sign', 'signal', 'pole', 'crosswalk'] as const;
export type Kind = (typeof KINDS)[number];

// How the stored mesh of the place sits in the game (scripts/furniture-frame.ts): shrink k, the mesh centre (ox, oz) and base (oy), and the one scene item that placed it.
export interface Frame { k: number; ox: number; oz: number; oy: number; rot: number; tx: number; ty: number; tz: number; scale: number; startX: number; finishX: number }
export interface FurnitureItem { id: string; kind: Kind; value: string; x: number; z: number; h: number; seen: string } // x, z: metres east and south of the pin; h: ground height there, real metres
export interface FurnitureFile { place: string; generated: string; source: string; licence: string; credit: string; frame: Frame; features: FurnitureItem[] }
export interface Placed { id: string; kind: Kind; x: number; y: number; z: number; moved: boolean }

export const LICENCE = { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' };
export const FURNITURE_ON = (q: URLSearchParams): boolean => q.get('furniture') === '1';
export const MIN_SCALE = 0.4; // a lamp post of a place shrunk to 0.07 would be 40 cm tall: objects are drawn at least this fraction of real size so they can be seen
export const LANE_HALF = 1.3, CLEAR_Z = 1.7; // the lane is blocks 2 m deep (z from -1 to 1): nothing is left closer than LANE_HALF to the run line, it goes to CLEAR_Z instead

// real metres east and south of the pin -> the game's x (along the run), height and z (across the lane), the way three.js turns the stored mesh about y
export function toGame(f: Frame, east: number, south: number, ground: number): { x: number; y: number; z: number } {
  const a = (east * f.k - f.ox) * f.scale, b = (south * f.k - f.oz) * f.scale, c = Math.cos(f.rot), s = Math.sin(f.rot);
  return { x: f.tx + c * a + s * b, y: f.ty + (ground * f.k - f.oy) * f.scale, z: f.tz - s * a + c * b };
}

export const drawScale = (f: Frame): number => Math.max(f.k * f.scale, MIN_SCALE);

// Furniture is only decoration: it is never in the physics. If one would stand in the lane band at the height the runner uses, it is moved sideways to CLEAR_Z.
// laneTop(x): the standing surface of the course at x, or -Infinity over a gap.
export function keepOffRun(p: { x: number; y: number; z: number }, laneTop: (x: number) => number): { z: number; moved: boolean } {
  if (Math.abs(p.z) >= LANE_HALF) return { z: p.z, moved: false };
  const top = laneTop(p.x);
  const inRunnerSpace = Number.isFinite(top) ? p.y > top - 0.6 && p.y < top + 4 : p.y > -1 && p.y < 4; // over a gap the runner's jump arc is the space
  return inRunnerSpace ? { z: p.z < 0 ? -CLEAR_Z : CLEAR_Z, moved: true } : { z: p.z, moved: false };
}

export function place(file: FurnitureFile, laneTop: (x: number) => number): { placed: Placed[]; moved: number } {
  const placed: Placed[] = [];
  for (const it of file.features) {
    if (!(KINDS as readonly string[]).includes(it.kind)) continue;
    const g = toGame(file.frame, it.x, it.z, it.h), k = keepOffRun(g, laneTop);
    placed.push({ id: it.id, kind: it.kind, x: g.x, y: g.y, z: k.z, moved: k.moved });
  }
  return { placed, moved: placed.filter((p) => p.moved).length };
}

export const countByKind = (items: { kind: Kind }[]): Record<string, number> => items.reduce<Record<string, number>>((m, i) => ((m[i.kind] = (m[i.kind] ?? 0) + 1), m), {});
