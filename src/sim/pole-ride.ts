import { DT } from './units';
import { DEFAULT_POLE, vault, type Bar, type PoleParams, type PoleResult } from './pole';

// The pole vault as a world mode (CC-239): E picks the pole up, holding E in the box plants it, letting go of E at the top sends the runner over.
// src/sim/pole.ts does the physics; this file only walks a runner along its path and says when the body is handed back to the ordinary physics.

/** What a course says about its pole: where it lies, where the plant box is, where the bar hangs and how high. Any PoleParams number may be tuned too. */
export interface PoleSetup extends Partial<PoleParams> {
  pickX: number; // the pole lies here on the ground
  x0: number; x1: number; // the plant box: hold E anywhere in it, carrying the pole, to jam it
  barX: number; // the bar hangs here
  barH: number; // the height the body's centre of mass must pass (pole.ts, measured from the plant)
}

export interface PoleRide {
  tipX: number; // where the planted tip is
  baseY: number; // the ground height at the plant
  vx: number; // the run speed at the plant
  bar: Bar; // the bar measured from the tip
  path: PoleResult['path'];
  result: PoleResult | null; // known from the let-go on; null while the key is still held
  t: number; // ticks since the plant
}

export interface PoleWorld { carrying: boolean; ride: PoleRide | null; barDown: boolean; over?: boolean } // over: a vault carried the runner past the bar; running under it does not count as the course

export const NO_POLE: PoleWorld = { carrying: false, ride: null, barDown: false };
export const POLE_PICKUP_REACH = 1.2; // m either side of the pole lying on the ground
export const POLE_MIN_SPEED = 2; // m/s: slower than a walk cannot plant

export const poleParamsOf = (s: PoleSetup): PoleParams => ({ ...DEFAULT_POLE, ...(s.length !== undefined ? { length: s.length } : {}), ...(s.stiffness !== undefined ? { stiffness: s.stiffness } : {}), ...(s.gripY !== undefined ? { gripY: s.gripY } : {}) });

/** The distance from the body to the planted tip at the plant (the body is behind the tip). */
export const plantReach = (p: PoleParams): number => Math.sqrt(p.length * p.length - p.gripY * p.gripY);

/** The bar as the picture draws it: the body's centre of mass is about a metre above the feet, and the model's point starts at hand height. */
export const barDrawnY = (s: PoleSetup): number => s.barH - (s.gripY ?? DEFAULT_POLE.gripY) + 1;

export function plant(s: PoleSetup, x: number, y: number, vx: number): PoleRide {
  const p = poleParamsOf(s);
  const tipX = x + plantReach(p);
  const bar: Bar = { x: s.barX - tipX, height: s.barH };
  return { tipX, baseY: y, vx, bar, path: vault(vx, bar, null, p).path, result: null, t: 0 };
}

/** Where the feet are at tick t of a ride (the model's point rises from the hand height at the plant; the feet rise by the same). */
export function poleFeetAt(r: PoleRide, s: PoleSetup, t: number): { x: number; y: number; vx: number; vy: number } {
  const p = poleParamsOf(s), path = r.path;
  const a = path[Math.min(t, path.length - 1)], b = path[Math.max(0, Math.min(t, path.length - 1) - 1)];
  return { x: r.tipX + a.x, y: r.baseY + a.y - p.gripY, vx: (a.x - b.x) / DT, vy: (a.y - b.y) / DT };
}

/** The key went up at tick t: the whole vault from here on is known. */
export function release(r: PoleRide, s: PoleSetup, t: number): PoleRide {
  const res = vault(r.vx, r.bar, Math.max(1, t - 1), poleParamsOf(s));
  return { ...r, result: res, path: res.path };
}
