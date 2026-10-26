// Physics lives here later (pure TypeScript, no three.js). One real unit so far: standard gravity on Earth.
export const GRAVITY = 9.81;

// How far something falls from rest in `seconds`.
export function fallDistance(seconds: number): number {
  return 0.5 * GRAVITY * seconds * seconds;
}
