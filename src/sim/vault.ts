import type { Platform, Terrain } from './terrain';
import { groundAt, heightAt, platformAt } from './terrain';

// The vault (V): a speed vault. The runner plants a foot well before the obstacle, puts one hand on top in the middle of the flight and the body
// arcs up and over it, then comes down a little past the edge on the top and runs on. It needs speed, an obstacle ahead whose top is 0.35 to 1.3 m
// above the feet, and ground to land on. It keeps most of the speed.
export const VAULT_MIN_SPEED = 3; // m/s
export const VAULT_BUFFER = 24; // ticks (0.2 s): a V pressed this early still counts when the obstacle comes in reach
export const VAULT_MIN_RISE = 0.35;
export const VAULT_MAX_RISE = 1.3;
export const VAULT_KEEP = 0.92; // share of the speed kept
export const VAULT_LAND_OFF = 0.5; // m: the feet come down this far past the front edge (0.3 to 0.8 m)
export const VAULT_LIFT = 0.25; // m: the feet pass this far above the top (the hand's push lifts the legs)
export const VAULT_MIN_GAP = 1.0; // m: closer than this to the front face is too late
export const VAULT_SLACK = 0.15; // m: a plant a little further than the ideal distance still works
export const VAULT_PLANT_TICKS = 36; // 0.3 s: after landing, with no key held, the feet plant and the runner stops
export const VAULT_PLANT_GRIP = 4; // times the ground grip while planting

// Where the runner plants the foot, in metres before the front face: further for a faster runner and for a taller obstacle (a speed vault:
// about 1.5 to 2.5 m at running speed), always inside 1.2 to 2.6 m.
export const takeoffDistance = (vx: number, rise: number): number => Math.min(2.6, Math.max(1.2, 0.9 + 0.12 * vx + 0.45 * rise));

// How long the vault lasts (s): the time to cover the plant distance plus the landing past the edge at the kept speed, and never less than it takes to
// climb over (a taller obstacle needs longer, so a very tall one at top speed costs some speed).
export const vaultTime = (vx: number, rise: number): number => Math.max(0.3 + 0.15 * rise, (takeoffDistance(vx, rise) + VAULT_LAND_OFF) / (Math.max(vx, VAULT_MIN_SPEED) * VAULT_KEEP));

export interface Vault {
  x0: number; y0: number; x1: number; y1: number; i: number; n: number; vx: number;
  edge: number; // x of the front face
  top: number; // height of the top at the front face
}

// The vault that starts now from feet at (x, y) running at vx, over platform p: null if it is not possible.
function make(t: Terrain, x: number, y: number, vx: number, p: Platform, gapMin: number): Vault | null {
  const top = heightAt(p, p.x0), rise = top - groundAt(t, x);
  if (rise < VAULT_MIN_RISE || rise > VAULT_MAX_RISE) return null;
  const gap = p.x0 - x;
  if (gap < gapMin || gap > takeoffDistance(vx, rise) + VAULT_SLACK) return null;
  const n = Math.max(1, Math.round(vaultTime(vx, rise) * 120));
  // the feet come down just past the edge (or in the middle of a short top)
  const x1 = Math.max(p.x0 + 0.15, Math.min(p.x0 + VAULT_LAND_OFF, p.x1 - 0.1, (p.x0 + p.x1) / 2));
  return { x0: x, y0: y, x1, y1: heightAt(p, x1), i: 0, n, vx, edge: p.x0, top };
}

export function findVault(t: Terrain, x: number, y: number, vx: number): Vault | null {
  if (vx < VAULT_MIN_SPEED) return null;
  const here = platformAt(t, x);
  if (!here) return null;
  for (const p of t.platforms) {
    if (p === here || p.x0 < x - 1e-6) continue;
    if (here.x1 < p.x0 - 0.02) continue; // a gap between: that is a jump, not a vault
    const v = make(t, x, y, vx, p, VAULT_MIN_GAP);
    if (v) return v;
  }
  return null;
}

// The vault the runner would make from the ideal plant point of the next vaultable step ahead (for the debug view and the tests), or null.
export function planVault(t: Terrain, x: number, y: number, vx: number, within = 10): { vault: Vault; plantX: number; windowFrom: number; windowTo: number } | null {
  if (vx < VAULT_MIN_SPEED) return null;
  const here = platformAt(t, x);
  if (!here) return null;
  for (const p of t.platforms) {
    if (p === here || p.x0 < x || p.x0 - x > within) continue;
    if (here.x1 < p.x0 - 0.02) continue;
    const rise = heightAt(p, p.x0) - groundAt(t, x);
    if (rise < VAULT_MIN_RISE || rise > VAULT_MAX_RISE) continue;
    const d = takeoffDistance(vx, rise), plantX = p.x0 - d;
    const v = make(t, plantX, y, vx, p, VAULT_MIN_GAP);
    if (v) return { vault: v, plantX, windowFrom: p.x0 - d - VAULT_SLACK - vx * (VAULT_BUFFER / 120), windowTo: p.x0 - VAULT_MIN_GAP };
  }
  return null;
}

// Where the feet are after tick i of a vault, and how fast they move (so nothing ever jumps: position and velocity are continuous every tick).
//   along: a cubic that starts at the speed the runner had and ends at the exit speed, covering the plant distance plus the landing past the edge;
//   up: a smooth rise (no push-off jump: speed 0 at the start) to VAULT_LIFT above the top at 60 to 70% of the vault, then a smooth drop onto the top (speed 0 at the end).
export function vaultAt(v: Vault, i: number): { x: number; y: number; vx: number; vy: number } {
  const T = v.n / 120, t = Math.min(1, i / v.n), D = v.x1 - v.x0, v0 = v.vx, v1 = vaultExitSpeed(v);
  const h01 = -2 * t * t * t + 3 * t * t, h10 = t * t * t - 2 * t * t + t, h11 = t * t * t - t * t;
  const dh01 = -6 * t * t + 6 * t, dh10 = 3 * t * t - 4 * t + 1, dh11 = 3 * t * t - 2 * t;
  const x = v.x0 + D * h01 + v0 * T * h10 + v1 * T * h11;
  const vx = (D * dh01 + v0 * T * dh10 + v1 * T * dh11) / T;
  const rise = v.y1 - v.y0, r = Math.sqrt(1 + rise / VAULT_LIFT), tp = r / (1 + r), apex = v.y1 + VAULT_LIFT;
  const S = (u: number) => 3 * u * u - 2 * u * u * u, dS = (u: number) => 6 * u - 6 * u * u;
  if (t < tp) { const u = t / tp; return { x, vx, y: v.y0 + (apex - v.y0) * S(u), vy: ((apex - v.y0) * dS(u)) / (tp * T) }; }
  const u = (t - tp) / (1 - tp);
  return { x, vx, y: apex - VAULT_LIFT * S(u), vy: (-VAULT_LIFT * dS(u)) / ((1 - tp) * T) };
}

// The contact point: where the hands stay on top of the obstacle, just behind its front edge (the actor pins the hands here and the debug view draws it).
export const VAULT_HAND_BEHIND = 0.15; // m past the front edge, onto the top
export function vaultHand(v: Vault): { x: number; y: number } {
  return { x: v.edge + VAULT_HAND_BEHIND, y: v.top };
}

// The speed the runner has during and after the vault: the kept share of the speed, but a late plant (a short run-up to the edge for the whole
// vault time) is a slow vault: the speed follows how fast the body really crossed, never below 60% of the kept speed.
export function vaultExitSpeed(v: Vault): number {
  const kept = v.vx * VAULT_KEEP, mean = (v.x1 - v.x0) / (v.n / 120);
  return Math.min(kept, Math.max(0.6 * kept, 1.25 * mean));
}
