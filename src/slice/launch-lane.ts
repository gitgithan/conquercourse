import type { CourseData } from '../course/course';

// A lane that starts in a trebuchet: the lane's own first deck is moved out, a deck for the machine goes in its place, and the rider is thrown across the gap.
// The editor keeps the lane as it is and calls this on the course it makes, so the proof and the Play button see the machine too.
export const TREBUCHET_DECK_END = 3; // m: the machine's deck ends just past the pivot (the pivot is at x = 0)
export const LANDING_FROM = 14; // m: where the lane's first ground starts, a throw away from the machine

export function withTrebuchet(c: CourseData, counterweight: number, pivotX = 0): CourseData {
  const ps = c.terrain.platforms;
  if (ps.length < 2) return c;
  const landingFrom = pivotX + LANDING_FROM;
  const dx = landingFrom - ps[1].x0;
  const move = <T extends { x0: number; x1: number }>(p: T): T => ({ ...p, x0: Math.round((p.x0 + dx) * 100) / 100, x1: Math.round((p.x1 + dx) * 100) / 100, ...('profile' in p && p.profile ? { profile: (p.profile as [number, number][]).map(([x, y]) => [Math.round((x + dx) * 100) / 100, y]) } : {}) });
  const rest = ps.slice(1).map(move);
  const { plan: _plan, checkpoints: _cp, ...keep } = c;
  void _plan; void _cp;
  return {
    ...keep,
    startX: pivotX - 12,
    finishX: Math.round((c.finishX + dx) * 100) / 100,
    terrain: { ...c.terrain, platforms: [{ x0: pivotX - 14, x1: pivotX + TREBUCHET_DECK_END, top: 0 }, ...rest] },
    holds: c.holds?.map((h) => ({ ...h, x: Math.round((h.x + dx) * 100) / 100 })),
    uMap: c.uMap?.map((m) => ({ ...m, x0: Math.round((m.x0 + dx) * 100) / 100 })),
    zones: [{ id: 'launch', name: 'Trebuchet', x0: pivotX - 12, x1: landingFrom }],
    checkpoints: [{ id: 'launch', x: pivotX - 12 }],
    trebuchet: { x: pivotX, counterweight },
  };
}
