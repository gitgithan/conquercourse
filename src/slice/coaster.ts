import type { CourseData } from '../course/course';
import { DEFAULT_CART, makeRails, type TrackData } from '../sim/cart';

// A coaster as a course: the rails through the points, a finish deck where they end, water below.
// Used by the editor (the Track piece), the demo courses and the tests.
export function coasterCourse(name: string, points: [number, number][] | [number, number][][], push = 1.5): CourseData {
  const first = points[0] as unknown[] | undefined;
  const segments = first && Array.isArray(first[0])
    ? (points as [number, number][][]).map((s) => [...s].sort((a, b) => a[0] - b[0]))
    : [[...(points as [number, number][])].sort((a, b) => a[0] - b[0])];
  const flat = segments.flat();
  const x0 = segments[0][0][0], last = segments[segments.length - 1], [x1, yEnd] = last[last.length - 1];
  const track: TrackData = { pts: flat, ...(segments.length > 1 ? { segments } : {}), push };
  const samples = segments.map((segment) => {
    const rails = makeRails(segment), count = Math.max(2, Math.ceil((rails.x1 - rails.x0) / 0.25));
    return Array.from({ length: count + 1 }, (_, i) => [rails.x0 + ((rails.x1 - rails.x0) * i) / count, rails.y(rails.x0 + ((rails.x1 - rails.x0) * i) / count) + DEFAULT_CART.seat] as [number, number]);
  });
  const low = Math.min(...samples.flat().map((q) => q[1]));
  const trackPlatforms = segments.map((segment, i) => {
    const profile = samples[i];
    return { x0: segment[0][0], x1: segment[segment.length - 1][0], top: Math.max(...profile.map((q) => q[1])), profile };
  });
  return {
    version: 1, name, startX: x0, finishX: x1, jumpSpeed: 4.5,
    terrain: { platforms: [...trackPlatforms, { x0: x1, x1: x1 + 24, top: yEnd + DEFAULT_CART.seat }], waterY: low - 3 },
    zones: [{ id: 'coaster', name: 'Coaster', x0, x1 }],
    checkpoints: [{ id: 'coaster', x: x0 }],
    track,
  };
}

// The three demo coasters: one that rides home, one whose second hill is too high, one with a hilltop too sharp to take at speed.
export const COASTER_DEMOS: Record<string, { name: string; pts: [number, number][]; push?: number }> = {
  coaster: { name: 'Coaster', pts: [[0, 9], [7, 5], [14, 1], [22, 0.6], [34, 3.6], [46, 0.6], [56, 0.2]] },
  'coaster-low': { name: 'Coaster: first hill too low', pts: [[0, 5], [8, 1], [18, 6.5], [30, 1], [42, 0.2]] },
  'coaster-sharp': { name: 'Coaster: a sharp hilltop', pts: [[0, 9], [7, 5], [14, 1], [22, 0.6], [27, 3.6], [32, 0.6], [46, 0.6], [56, 0.2]] },
};

// A track from the address (?coaster=0,9;7,5|20,4;28,1&push=1.5): up to 32 dots split into rising-x sections; anything else is refused.
export function parseTrack(text: string | null): [number, number][][] | null {
  if (!text) return null;
  const segments = text.split('|').map((s) => s.split(';').map((q) => q.split(',').map(Number) as [number, number]));
  const pts = segments.flat();
  if (segments.some((s) => s.length < 2) || pts.length < 3 || pts.length > 32 || pts.some((p) => p.length !== 2 || !p.every(Number.isFinite))) return null;
  if (pts.some((p) => Math.abs(p[0]) > 400 || p[1] < 0)) return null;
  for (let s = 0; s < segments.length; s++) {
    for (let i = 1; i < segments[s].length; i++) if (segments[s][i][0] <= segments[s][i - 1][0]) return null;
    if (s && segments[s][0][0] <= segments[s - 1][segments[s - 1].length - 1][0]) return null;
  }
  return segments;
}
