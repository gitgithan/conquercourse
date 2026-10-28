import type { Mesh } from './slice';
import { newPiece, type Piece } from './world';

// Sport stacking: cups (mouth down) piled in pyramids. A formation is a pyramid of 1, 3, 6 or 10 cups (bases of 1, 2, 3 and 4);
// a pattern is a row of formations ("3-6-3" is a 3-cup, a 6-cup and a 3-cup pyramid), with one cup's width of floor between them.
// Everything here is in real cup metres (a cup is about 9 cm); the editor's piece scale makes the stack big enough for a runner.
export const CUP = { h: 0.09, mouth: 0.09, top: 0.05, rise: 0.072 }; // m; rise: how much higher each row sits (a cup nests a little over the two below)
export const ACROSS = 4; // cups side by side across the lane
export const FLOOR = 0.004; // m, the thin floor under the stack (cell height of the ground between pyramids)

export interface Pattern { id: string; label: string; formations: number[]; scale: number } // scale: the default piece scale (metres per cup metre)
export const PATTERNS: Pattern[] = [
  { id: '3-3-3', label: '3-3-3', formations: [3, 3, 3], scale: 5 },
  { id: '3-6-3', label: '3-6-3', formations: [3, 6, 3], scale: 4.5 },
  { id: '6-6', label: '6-6', formations: [6, 6], scale: 4.5 },
  { id: '1-10-1', label: '1-10-1', formations: [1, 10, 1], scale: 3.5 },
  { id: 'cycle', label: 'Cycle (3-6-3, 6-6)', formations: [3, 6, 3, 6, 6], scale: 3 },
];
export const STACK_PREFIX = 'stack:';
export const stackSrc = (id: string) => `${STACK_PREFIX}${id}`;
export const patternOf = (src: string | undefined): Pattern | undefined => (src?.startsWith(STACK_PREFIX) ? PATTERNS.find((p) => p.id === src.slice(STACK_PREFIX.length)) : undefined);

// The base length (in cups) of a pyramid of this many cups: 1, 3, 6, 10 cups have bases of 1, 2, 3, 4.
export const baseOf = (cups: number): number => Math.round((Math.sqrt(8 * cups + 1) - 1) / 2);

export interface Cup { x: number; y: number; row: number; z: number } // x: centre along the run, y: bottom, z: across the lane

// Every cup of a pattern, x from 0 (the left end of the first pyramid), in cup metres. `margin` of floor is added by callers.
export function stackCups(pattern: Pattern): { cups: Cup[]; length: number } {
  const cups: Cup[] = [];
  let x0 = 0;
  pattern.formations.forEach((f, fi) => {
    const n = baseOf(f);
    for (let k = 0; k < n; k++) for (let i = 0; i < n - k; i++) for (let a = 0; a < ACROSS; a++) {
      cups.push({ x: x0 + (k / 2 + i + 0.5) * CUP.mouth, y: k * CUP.rise, row: k, z: (a - (ACROSS - 1) / 2) * CUP.mouth });
    }
    x0 += n * CUP.mouth + (fi < pattern.formations.length - 1 ? CUP.mouth : 0);
  });
  return { cups, length: x0 };
}

// The outline seen from the side: where the surface steps up or down. Intervals are in cup metres from the left end of the first pyramid.
export function stackSteps(pattern: Pattern): { x0: number; x1: number; top: number }[] {
  const out: { x0: number; x1: number; top: number }[] = [];
  let x0 = 0;
  pattern.formations.forEach((f, fi) => {
    const n = baseOf(f);
    // row k covers [k/2, k/2 + (n - k)] cups from the pyramid's left; the highest row over a point sets the height there
    const cuts = new Set<number>();
    for (let k = 0; k < n; k++) { cuts.add(k / 2); cuts.add(k / 2 + (n - k)); }
    const xs = [...cuts].sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i++) {
      const mid = (xs[i] + xs[i + 1]) / 2;
      let top = 0;
      for (let k = 0; k < n; k++) if (mid >= k / 2 && mid <= k / 2 + (n - k)) top = Math.max(top, k * CUP.rise + CUP.h);
      if (top > 0) out.push({ x0: x0 + xs[i] * CUP.mouth, x1: x0 + xs[i + 1] * CUP.mouth, top });
    }
    x0 += n * CUP.mouth + (fi < pattern.formations.length - 1 ? CUP.mouth : 0);
  });
  return out;
}

// Height of the stack's surface at x (cup metres from the left end of the first pyramid): the floor between pyramids.
export function stackHeightAt(pattern: Pattern, x: number): number {
  let h = FLOOR;
  for (const s of stackSteps(pattern)) if (x >= s.x0 && x <= s.x1) h = Math.max(h, s.top);
  return h;
}

// Height of the tallest point, in cup metres, and in real metres at a piece scale.
export const stackHeight = (pattern: Pattern): number => Math.max(...stackSteps(pattern).map((s) => s.top));

// The collision mesh: a thin floor with the stepped outline on it, as boxes across the lane (the picture is the cups; the simulator walks on this).
// It stands on y = 0 and covers one cup of floor on each side of the pyramids, so a piece is a small deck with the stack on it.
export function stackCollider(pattern: Pattern): Mesh {
  const { length } = stackCups(pattern);
  const half = (ACROSS * CUP.mouth) / 2, m = CUP.mouth;
  const positions: number[] = [], indices: number[] = [];
  const box = (xa: number, xb: number, top: number) => {
    const b = positions.length / 3;
    for (const [x, y, z] of [[xa, 0, -half], [xb, 0, -half], [xb, top, -half], [xa, top, -half], [xa, 0, half], [xb, 0, half], [xb, top, half], [xa, top, half]]) positions.push(x, y, z);
    for (const t of [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2]) indices.push(b + t);
  };
  box(-m, length + m, FLOOR);
  for (const s of stackSteps(pattern)) box(s.x0, s.x1, s.top);
  return { positions, indices };
}

// An editor piece for a pattern (src "stack:<id>"): the collider as its mesh, the cups drawn from the src, scale = the pattern's default.
export function stackPiece(src: string, at: { x: number; z: number } = { x: 0, z: 0 }): (Piece & { src: string }) | null {
  const pattern = patternOf(src);
  if (!pattern) return null;
  return { ...newPiece(`Stack ${pattern.label}`, stackCollider(pattern), at), src, scale: pattern.scale };
}
