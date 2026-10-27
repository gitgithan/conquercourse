// Real constants. Everything in the simulator is metres, seconds and kilograms-free (per unit mass).
export const GRAVITY = 9.81;

// The simulator's only clock: whole ticks of 1/120 s.
export const TICKS_PER_SECOND = 120;
export const DT = 1 / TICKS_PER_SECOND;

export const ticksToSeconds = (ticks: number): number => ticks / TICKS_PER_SECOND;

// How far something falls from rest in `seconds`.
export function fallDistance(seconds: number): number {
  return 0.5 * GRAVITY * seconds * seconds;
}
