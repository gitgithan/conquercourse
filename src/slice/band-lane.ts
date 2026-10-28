import type { CourseData } from '../course/course';
import { DEFAULT_BAND } from '../sim/band';

// A lane that starts at an elastic band: a long runway behind the post for the pull, a take-off edge just past it, and the lane's own ground a gap away.
// The editor keeps the lane as it is and calls this on the course it makes, so the proof and the Play button see the band too.
export const BAND_EDGE = 1.5; // m: the runway ends just past the post (the post is at x = 0, the clip at x = -1)
export const BAND_RUNWAY = 40; // m of runway behind the post, enough for the longest stretch
export const BAND_LANDING_FROM = 12.5; // m: where the lane's own ground starts, a throw away from the edge

export function withBand(c: CourseData, k: number): CourseData {
  const ps = c.terrain.platforms;
  if (ps.length < 2) return c;
  const dx = BAND_LANDING_FROM - ps[1].x0;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const move = <T extends { x0: number; x1: number }>(p: T): T => ({ ...p, x0: r2(p.x0 + dx), x1: r2(p.x1 + dx), ...('profile' in p && p.profile ? { profile: (p.profile as [number, number][]).map(([x, y]) => [r2(x + dx), y]) } : {}) });
  const rest = ps.slice(1).map(move);
  const { plan: _plan, checkpoints: _cp, ...keep } = c;
  void _plan; void _cp;
  return {
    ...keep,
    startX: -DEFAULT_BAND.rest,
    finishX: r2(c.finishX + dx),
    terrain: { ...c.terrain, platforms: [{ x0: -BAND_RUNWAY, x1: BAND_EDGE, top: 0 }, ...rest] },
    holds: c.holds?.map((h) => ({ ...h, x: r2(h.x + dx) })),
    uMap: c.uMap?.map((m) => ({ ...m, x0: r2(m.x0 + dx) })),
    zones: [{ id: 'band', name: 'Elastic band', x0: -30, x1: BAND_LANDING_FROM }],
    checkpoints: [{ id: 'band', x: -DEFAULT_BAND.rest }],
    band: { x: 0, rest: DEFAULT_BAND.rest, k, snap: 22 },
  };
}
