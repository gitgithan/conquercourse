import type { Terrain } from './terrain';
import { groundAt, heightAt, platformAt } from './terrain';

// The vault (V): a hand goes on top of an obstacle and the body goes over it without leaving the ground in a long arc.
// It needs speed, an obstacle just ahead whose top is 0.35 to 1.3 m above the feet, and ground to land on. It keeps most of the speed.
export const VAULT_MIN_SPEED = 3; // m/s
export const VAULT_REACH = 0.9; // m ahead of the feet where the front face must be
export const VAULT_MIN_RISE = 0.35;
export const VAULT_MAX_RISE = 1.3;
export const VAULT_KEEP = 0.92; // share of the speed kept

export interface Vault { x0: number; y0: number; x1: number; y1: number; i: number; n: number; vx: number }

export function findVault(t: Terrain, x: number, y: number, vx: number): Vault | null {
  if (vx < VAULT_MIN_SPEED) return null;
  const here = platformAt(t, x);
  if (!here) return null;
  for (const p of t.platforms) {
    if (p === here || p.x0 < x - 1e-6 || p.x0 - x > VAULT_REACH) continue;
    if (here.x1 < p.x0 - 0.02) continue; // a gap between: that is a jump, not a vault
    const rise = heightAt(p, p.x0) - groundAt(t, x);
    if (rise < VAULT_MIN_RISE || rise > VAULT_MAX_RISE) continue;
    const n = Math.round((0.28 + 0.2 * rise) * 120);
    // the body moves on at about the kept speed while the hand is on top; it comes down on the obstacle (or the middle of a short one)
    const x1 = Math.max(p.x0 + 0.3, Math.min(x + (vx * VAULT_KEEP * n) / 120, p.x1 - 0.1, (p.x0 + p.x1) / 2 + (p.x1 - p.x0) / 4));
    return { x0: x, y0: y, x1, y1: heightAt(p, x1), i: 0, n, vx };
  }
  return null;
}

// Where the feet are after tick i of a vault: along the way at a steady pace, up fast then easing onto the top (the hand pushes).
export function vaultAt(v: Vault, i: number): { x: number; y: number } {
  const t = Math.min(1, i / v.n);
  const up = 1 - (1 - t) * (1 - t);
  return { x: v.x0 + (v.x1 - v.x0) * t, y: v.y0 + (v.y1 - v.y0) * up };
}
