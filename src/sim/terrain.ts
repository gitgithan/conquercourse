// The ground the runner stands on: platforms with gaps between them; below a gap lies water.
export interface Platform {
  x0: number;
  x1: number;
  top: number; // height of the standing surface, m
  bouncy?: boolean; // a trampoline bed: landing here starts a bounce
  profile?: [number, number][]; // a curved top: [x, height] points from x0 to x1 (x rising), joined by straight pieces; `top` is then its highest point
  coasterRail?: boolean; // collision surface for landing on a coaster rail; the visible rail is drawn by src/render/track.ts
  gate?: number; // lane gate (CC-228): this stretch is solid only after the runner has stood on the platform with this index; without it the stretch is air. A fork's far floors need this so they cannot be reached by a jump from before the fork.
  skin?: { image: string; crop: [number, number, number, number] }; // a picture painted on the front face: the image's address and the part of it (in pixels) to use; looks only, never collision
}

export interface Terrain {
  platforms: Platform[];
  waterY: number; // water surface height; touching it ends the run
}

export const FLAT: Terrain = { platforms: [{ x0: -1e9, x1: 1e9, top: 0 }], waterY: -1 };

// Height of one platform's standing surface at x (flat unless it has a profile).
export function heightAt(p: Platform, x: number): number {
  const pr = p.profile;
  if (!pr || pr.length < 2) return p.top;
  if (x <= pr[0][0]) return pr[0][1];
  for (let i = 1; i < pr.length; i++) {
    if (x <= pr[i][0]) { const [xa, ya] = pr[i - 1], [xb, yb] = pr[i]; return xb === xa ? yb : ya + ((yb - ya) * (x - xa)) / (xb - xa); }
  }
  return pr[pr.length - 1][1];
}

// Highest standing surface at x, or -Infinity over a gap.
export function groundAt(t: Terrain, x: number): number {
  let top = -Infinity;
  for (const p of t.platforms) if (x >= p.x0 && x <= p.x1) top = Math.max(top, heightAt(p, x));
  return top;
}

// The platform whose left edge is the next one at or after x (used when the runner hits a block's side).
export function platformAt(t: Terrain, x: number): Platform | undefined {
  let best: Platform | undefined, bestH = -Infinity;
  for (const p of t.platforms) {
    if (x < p.x0 || x > p.x1) continue;
    const h = p.profile ? heightAt(p, x) : p.top;
    if (h > bestH) { best = p; bestH = h; }
  }
  return best;
}

// The platform the feet stand on at x (the highest one there).
export function standingOn(t: Terrain, x: number): Platform | undefined {
  return platformAt(t, x);
}
