import type { CourseData } from '../course/course';

// A coaster as a course: the rails through the points, a finish deck where they end, water below.
// Used by the editor (the Track piece), the demo courses and the tests.
export function coasterCourse(name: string, pts: [number, number][], push = 1.5): CourseData {
  const sorted = [...pts].sort((a, b) => a[0] - b[0]);
  const x0 = sorted[0][0], [x1, yEnd] = sorted[sorted.length - 1];
  const low = Math.min(...sorted.map((q) => q[1]));
  return {
    version: 1, name, startX: x0, finishX: x1, jumpSpeed: 4.5,
    terrain: { platforms: [{ x0: x1, x1: x1 + 24, top: yEnd }], waterY: Math.min(0, low) - 3 },
    zones: [{ id: 'coaster', name: 'Coaster', x0, x1 }],
    checkpoints: [{ id: 'coaster', x: x0 }],
    track: { pts: sorted.map(([x, y]) => [x, y] as [number, number]), push },
  };
}

// The three demo coasters: one that rides home, one whose second hill is too high, one with a hilltop too sharp to take at speed.
export const COASTER_DEMOS: Record<string, { name: string; pts: [number, number][]; push?: number }> = {
  coaster: { name: 'Coaster', pts: [[0, 9], [7, 5], [14, 1], [22, 0.6], [34, 3.6], [46, 0.6], [56, 0.2]] },
  'coaster-low': { name: 'Coaster: first hill too low', pts: [[0, 5], [8, 1], [18, 6.5], [30, 1], [42, 0.2]] },
  'coaster-sharp': { name: 'Coaster: a sharp hilltop', pts: [[0, 9], [7, 5], [14, 1], [22, 0.6], [27, 3.6], [32, 0.6], [46, 0.6], [56, 0.2]] },
};

// A track from the address (?coaster=0,9;7,5;14,1&push=1.5): between 3 and 14 dots, x rising, sensible heights; anything else is refused.
export function parseTrack(text: string | null): [number, number][] | null {
  if (!text) return null;
  const pts = text.split(';').map((s) => s.split(',').map(Number) as [number, number]);
  if (pts.length < 3 || pts.length > 14 || pts.some((p) => p.length !== 2 || !p.every(Number.isFinite))) return null;
  if (pts.some((p) => Math.abs(p[0]) > 400 || p[1] < 0 || p[1] > 40)) return null;
  for (let i = 1; i < pts.length; i++) if (pts[i][0] <= pts[i - 1][0]) return null;
  return pts;
}
