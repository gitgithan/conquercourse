// The Slicer (CC-73, part of the Atlas, CC-72): cut a place with a horizontal plane.
// A horizontal cut of a hill is a contour line; a horizontal cut of a building is its floor plan; the lane the Course uses is cut at one height.
// Pure maths: no page, no network. Metres, x east, z south, centred on the pin, like src/world/osm.ts.
import { groundAt, lowest, relief, type Ground } from '../world/terrain';
import { MAX_SHRUNK_HEIGHT, type Building } from '../world/osm';

export type Seg = [number, number, number, number]; // x0, z0, x1, z1

// A finer copy of the heights grid, so contour lines are smooth instead of following the 20 m grid.
export function resample(g: Ground, step: number): Ground {
  const n = Math.max(2, Math.round((2 * g.radius) / step) + 1), s = (2 * g.radius) / (n - 1), h: number[] = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) h.push(groundAt(g, -g.radius + i * s, -g.radius + j * s));
  return { radius: g.radius, step: s, n, h };
}

// Marching squares: the line where the ground is exactly `level` high (level is a height in the grid's own units; add lowest(g) to a cut height).
export function contourSegments(g: Ground, level: number, fine = 4): Seg[] {
  const f = g.step > fine ? resample(g, fine) : g;
  const v = (i: number, j: number) => f.h[j * f.n + i], X = (i: number) => -f.radius + i * f.step, Z = (j: number) => -f.radius + j * f.step;
  const at = (p0: number, p1: number, v0: number, v1: number) => p0 + (p1 - p0) * ((level - v0) / (v1 - v0));
  const out: Seg[] = [];
  for (let j = 0; j < f.n - 1; j++) for (let i = 0; i < f.n - 1; i++) {
    const a = v(i, j), b = v(i + 1, j), c = v(i + 1, j + 1), d = v(i, j + 1); // corners: top-left, top-right, bottom-right, bottom-left
    const idx = (a >= level ? 1 : 0) | (b >= level ? 2 : 0) | (c >= level ? 4 : 0) | (d >= level ? 8 : 0);
    if (idx === 0 || idx === 15) continue;
    const top = (): [number, number] => [at(X(i), X(i + 1), a, b), Z(j)];
    const right = (): [number, number] => [X(i + 1), at(Z(j), Z(j + 1), b, c)];
    const bottom = (): [number, number] => [at(X(i), X(i + 1), d, c), Z(j + 1)];
    const left = (): [number, number] => [X(i), at(Z(j), Z(j + 1), a, d)];
    const add = (p: [number, number], q: [number, number]) => out.push([p[0], p[1], q[0], q[1]]);
    const centreHigh = (a + b + c + d) / 4 >= level;
    switch (idx) {
      case 1: case 14: add(left(), top()); break;
      case 2: case 13: add(top(), right()); break;
      case 3: case 12: add(left(), right()); break;
      case 4: case 11: add(right(), bottom()); break;
      case 6: case 9: add(top(), bottom()); break;
      case 7: case 8: add(left(), bottom()); break;
      case 5: if (centreHigh) { add(top(), right()); add(left(), bottom()); } else { add(left(), top()); add(right(), bottom()); } break;
      case 10: if (centreHigh) { add(left(), top()); add(right(), bottom()); } else { add(top(), right()); add(left(), bottom()); } break;
    }
  }
  return out;
}

// Contour lines every N metres, with N picked so a place shows between 6 and 10 lines (as far as its relief allows).
const STEPS = [0.25, 0.5, 1, 1.5, 2, 2.5, 5, 7.5, 10, 15, 20, 25, 50, 75, 100, 150, 200, 250, 500];
const linesAt = (rel: number, s: number) => Math.max(0, Math.ceil(rel / s) - 1); // the lines strictly inside the relief
export function ladderStep(rel: number): number {
  for (const s of STEPS) if (linesAt(rel, s) <= 10) return s;
  return STEPS[STEPS.length - 1];
}
export function ladderLevels(rel: number): number[] {
  const s = ladderStep(rel), out: number[] = [];
  for (let c = s; c < rel; c += s) out.push(Math.round(c * 1000) / 1000);
  return out;
}

// How steep the ground is, in cells of `cell` metres (degrees), for a faint tint under the map.
export interface SlopeCell { x0: number; z0: number; x1: number; z1: number; deg: number }
export function slopeCells(g: Ground, cell = 6): SlopeCell[] {
  const out: SlopeCell[] = [], n = Math.max(1, Math.floor((2 * g.radius) / cell)), s = (2 * g.radius) / n, e = s / 2;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = -g.radius + (i + 0.5) * s, z = -g.radius + (j + 0.5) * s;
    const dx = (groundAt(g, x + e, z) - groundAt(g, x - e, z)) / s, dz = (groundAt(g, x, z + e) - groundAt(g, x, z - e)) / s;
    out.push({ x0: x - s / 2, z0: z - s / 2, x1: x + s / 2, z1: z + s / 2, deg: (Math.atan(Math.hypot(dx, dz)) * 180) / Math.PI });
  }
  return out;
}

// Buildings as the game builds them (src/world/osm.ts extrude): walls run from the lowest ground up to the roof,
// which is its own (shrunk) height above the ground at the building's middle. `top` is real metres above the lowest ground.
export interface CutBuilding { ring: [number, number][]; top: number; cut: boolean }
const area2 = (p: [number, number][]) => p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0);
export function buildingTops(bs: Building[], k: number, ground?: Ground | null): { ring: [number, number][]; top: number }[] {
  const out: { ring: [number, number][]; top: number }[] = [];
  for (const b of bs) {
    const ring = b.ring.slice();
    if (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) ring.pop();
    if (ring.length < 3 || Math.abs(area2(ring)) < 4) continue; // the same rule as the game's mesh
    const cx = ring.reduce((t, p) => t + p[0], 0) / ring.length, cz = ring.reduce((t, p) => t + p[1], 0) / ring.length;
    out.push({ ring, top: (ground ? groundAt(ground, cx, cz) - lowest(ground) : 0) + Math.min(b.h, MAX_SHRUNK_HEIGHT / k) });
  }
  return out;
}
// The plane at `c` metres cuts every building whose roof is at or above it.
export const cutBuildings = (tops: { ring: [number, number][]; top: number }[], c: number): CutBuilding[] => tops.map((t) => ({ ...t, cut: c <= t.top }));
// The highest the slider needs to go: the highest roof.
export const cutRange = (tops: { top: number }[], ground?: Ground | null) => Math.max(Math.ceil(relief(ground)), Math.ceil(Math.max(0, ...tops.map((t) => t.top))));

// The lane the search found, as a straight line on the map in real metres (the lane is cut at the rod through the pin).
export function laneLine(l: { angle: number; offset: number; origin: number; length: number }, k: number): [number, number][] {
  const dx = Math.cos(l.angle), dz = Math.sin(l.angle), nx = -dz, nz = dx, at = (u: number): [number, number] => [(u * dx + l.offset * nx) / k, (u * dz + l.offset * nz) / k];
  return [at(l.origin), at(l.origin + l.length)];
}

// Metres east and south of the pin to [lon, lat]
export function toLonLat(lat0: number, lon0: number, x: number, z: number): [number, number] {
  return [lon0 + x / (111320 * Math.cos((lat0 * Math.PI) / 180)), lat0 - z / 111320];
}
