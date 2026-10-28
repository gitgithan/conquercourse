import type { Terrain } from './terrain';
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
export const VAULT_MIN_GAP = 0.3; // m: closer than this to the front face is too late
export const VAULT_SLACK = 0.15; // m: a plant a little further than the ideal distance still works
export const VAULT_PLANT_TICKS = 36; // 0.3 s: after landing, with no key held, the feet plant and the runner stops
export const VAULT_PLANT_GRIP = 4; // times the ground grip while planting

// How long the vault lasts (s): longer for a taller obstacle (more to climb over).
export const vaultTime = (rise: number): number => 0.34 + 0.18 * rise;

// Where the runner plants the foot, in metres before the front face: the body travels at the kept speed for the whole vault and the feet come down
// VAULT_LAND_OFF past the edge, so the distance is what is left (a faster runner or a taller obstacle plants further back, the speed-vault way).
export const takeoffDistance = (vx: number, rise: number): number => Math.min(3.2, Math.max(0.9, vx * VAULT_KEEP * vaultTime(rise) - VAULT_LAND_OFF));

export interface Vault {
  x0: number; y0: number; x1: number; y1: number; i: number; n: number; vx: number;
  edge: number; // x of the front face
  top: number; // height of the top at the front face
}

export function findVault(t: Terrain, x: number, y: number, vx: number): Vault | null {
  if (vx < VAULT_MIN_SPEED) return null;
  const here = platformAt(t, x);
  if (!here) return null;
  for (const p of t.platforms) {
    if (p === here || p.x0 < x - 1e-6) continue;
    if (here.x1 < p.x0 - 0.02) continue; // a gap between: that is a jump, not a vault
    const top = heightAt(p, p.x0), rise = top - groundAt(t, x);
    if (rise < VAULT_MIN_RISE || rise > VAULT_MAX_RISE) continue;
    const gap = p.x0 - x;
    if (gap < VAULT_MIN_GAP || gap > takeoffDistance(vx, rise) + VAULT_SLACK) continue;
    const n = Math.max(1, Math.round(vaultTime(rise) * 120));
    // the feet come down just past the edge (or in the middle of a short top)
    const x1 = Math.max(p.x0 + 0.15, Math.min(p.x0 + VAULT_LAND_OFF, p.x1 - 0.1, (p.x0 + p.x1) / 2));
    return { x0: x, y0: y, x1, y1: heightAt(p, x1), i: 0, n, vx, edge: p.x0, top };
  }
  return null;
}

// Where the feet are after tick i of a vault: along at a steady pace, and up over the edge on a parabola that peaks VAULT_LIFT above the top
// (about 60 to 70% of the way through), then down onto the top. The hand's push is why the arc is tighter than a free fall.
export function vaultAt(v: Vault, i: number): { x: number; y: number } {
  const t = Math.min(1, i / v.n), rise = v.y1 - v.y0;
  const r = Math.sqrt(1 + rise / VAULT_LIFT); // from y0 = apex - lift*r^2 and y1 = apex - lift
  const tp = r / (1 + r); // the apex, as a share of the vault
  const y = v.y1 + VAULT_LIFT - VAULT_LIFT * ((t - tp) / (1 - tp)) ** 2;
  return { x: v.x0 + (v.x1 - v.x0) * t, y: Math.max(Math.min(v.y0, v.y1), y) };
}

// The hand: on top of the obstacle just behind its front edge, at about 40% of the vault (before the feet pass the edge).
export const VAULT_HAND_AT = 0.4;
export function vaultHand(v: Vault): { x: number; y: number; at: number } {
  return { x: v.edge + 0.15, y: v.top, at: VAULT_HAND_AT };
}

// The speed the runner has during and after the vault: the kept share of the speed, but a late plant (a short run-up to the edge for the whole
// vault time) is a slow vault: the speed follows how fast the body really crossed, never below 60% of the kept speed.
export function vaultExitSpeed(v: Vault): number {
  const kept = v.vx * VAULT_KEEP, mean = (v.x1 - v.x0) / (v.n / 120);
  return Math.min(kept, Math.max(0.6 * kept, 1.25 * mean));
}
