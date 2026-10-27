// The ground the runner stands on: platforms with gaps between them; below a gap lies water.
export interface Platform {
  x0: number;
  x1: number;
  top: number; // height of the standing surface, m
  bouncy?: boolean; // a trampoline bed: landing here starts a bounce
}

export interface Terrain {
  platforms: Platform[];
  waterY: number; // water surface height; touching it ends the run
}

export const FLAT: Terrain = { platforms: [{ x0: -1e9, x1: 1e9, top: 0 }], waterY: -1 };

// Highest standing surface at x, or -Infinity over a gap.
export function groundAt(t: Terrain, x: number): number {
  let top = -Infinity;
  for (const p of t.platforms) if (x >= p.x0 && x <= p.x1 && p.top > top) top = p.top;
  return top;
}

// The platform whose left edge is the next one at or after x (used when the runner hits a block's side).
export function platformAt(t: Terrain, x: number): Platform | undefined {
  return t.platforms.filter((p) => x >= p.x0 && x <= p.x1).sort((a, b) => b.top - a.top)[0];
}

// The platform the feet stand on at x (the highest one there).
export function standingOn(t: Terrain, x: number): Platform | undefined {
  return platformAt(t, x);
}
