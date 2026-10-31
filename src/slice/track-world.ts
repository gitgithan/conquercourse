import type { CourseData } from '../course/course';
import { DEFAULT_CART, makeRails } from '../sim/cart';
import type { Mesh } from './slice';
import type { P } from './holds-world';
import { newPiece } from './world';

// Coaster sections in the editor (CC-244): a piece whose src is "track:x,y;x,y;..." is a stretch of rail, drawn as a thin ribbon.
// The ribbon is ground for the slice (so the lane sees its height), and roleCourse turns the platform it makes into rails the cart rides.
// Gaps between sections are real gaps: the cart leaves the end of one with the speed it has, the rider flies, and bars or ropes can catch them.
export const isTrack = (p: P): boolean => !!p.src?.startsWith('track:');
export const TRACK_WIDTH = 2; // m across the lane

export type TrackPts = [number, number][];
export const trackSrc = (pts: TrackPts): string => `track:${pts.map(([x, y]) => `${+x.toFixed(2)},${+y.toFixed(2)}`).join(';')}`;
export function parseTrackSrc(src: string): TrackPts | null {
  if (!src.startsWith('track:')) return null;
  const pts = src.slice(6).split(';').map((q) => q.split(',').map(Number) as [number, number]);
  if (pts.length < 2 || pts.length > 16 || pts.some((q) => q.length !== 2 || !q.every(Number.isFinite))) return null;
  for (let i = 1; i < pts.length; i++) if (pts[i][0] <= pts[i - 1][0]) return null;
  return pts;
}

/** The sections a person can add: the first rides from rest (a high start), the others are gentle and catch the rider from the air or from the end of the section before. */
export const TRACK_SHAPES: { id: string; name: string; pts: TrackPts }[] = [
  { id: 'start', name: 'High start', pts: [[0, 9], [7, 5], [14, 1], [22, 0.6]] },
  { id: 'dip', name: 'Gentle dip', pts: [[0, 1.2], [5, 0.6], [10, 0.2], [15, 0]] },
  { id: 'glide', name: 'Long glide', pts: [[0, 0.8], [8, 0.4], [16, 0.1], [24, 0]] },
  { id: 'wave', name: 'Gentle wave', pts: [[0, 1.6], [4, 0.9], [8, 1], [12, 0.4], [16, 0.5], [20, 0]] },
];

/** The rail the cart really rides (a smooth curve through the dots), sampled every half metre, so the ribbon curves where the rail does (CC-244). */
export function smoothPts(pts: TrackPts): TrackPts {
  const rails = makeRails(pts), count = Math.max(2, Math.ceil((rails.x1 - rails.x0) / 0.5));
  return Array.from({ length: count + 1 }, (_, i) => { const x = rails.x0 + ((rails.x1 - rails.x0) * i) / count; return [x, rails.y(x)] as [number, number]; });
}

/** A ribbon along the rail: the top surface is what the slice reads. */
export function trackMesh(dots: TrackPts): Mesh {
  const pts = smoothPts(dots);
  const positions: number[] = [], indices: number[] = [];
  const half = TRACK_WIDTH / 2;
  pts.forEach(([x, y]) => positions.push(x, y, -half, x, y, half));
  for (let i = 0; i + 1 < pts.length; i++) { const a = i * 2; indices.push(a, a + 1, a + 3, a, a + 3, a + 2, a, a + 3, a + 1, a, a + 2, a + 3); }
  return { positions, indices };
}

/** The rails of one section in game x, with the seat height added the way coasterCourse does. */
export function railProfile(seg: TrackPts): [number, number][] {
  const rails = makeRails(seg), count = Math.max(2, Math.ceil((rails.x1 - rails.x0) / 0.25));
  return Array.from({ length: count + 1 }, (_, i) => { const x = rails.x0 + ((rails.x1 - rails.x0) * i) / count; return [x, rails.y(x) + DEFAULT_CART.seat] as [number, number]; });
}

/** Where each section's points lie in the lane: u along the run, y over the lane's level. */
export function sectionPoints(p: P, pts: TrackPts, u: number, level: number): TrackPts {
  const mid = (pts[0][0] + pts[pts.length - 1][0]) / 2, low = Math.min(...pts.map((q) => q[1]));
  return pts.map(([x, y]) => [u + (x - mid) * p.scale, p.y + (y - low) * p.scale - level] as [number, number]);
}

/** Turn the platforms under the track pieces into rails. `place` gives the section's points as (game x, height); the ride starts at the first section. */
export function applyTracks(course: CourseData, sections: TrackPts[], push = 1.5): string[] {
  const notes: string[] = [];
  const plats = course.terrain.platforms, segments: TrackPts[] = [];
  const r2 = (v: number) => Math.round(v * 100) / 100;
  for (const seg of [...sections].sort((a, b) => a[0][0] - b[0][0])) {
    const plat = plats.find((q) => Math.abs(q.x0 - seg[0][0]) < 0.3 && q.x0 >= 6);
    if (!plat) { notes.push('A coaster section has no ground of its own: keep it clear of other ground.'); continue; }
    const rounded = seg.map(([x, y]) => [r2(x), r2(y)] as [number, number]);
    const profile = railProfile(rounded);
    plat.x0 = rounded[0][0]; plat.x1 = rounded[rounded.length - 1][0];
    plat.profile = profile; plat.top = Math.max(...profile.map((q) => q[1])); plat.coasterRail = true;
    segments.push(rounded);
  }
  if (!segments.length) return notes;
  const first = segments[0][0][0];
  if (plats.some((q) => !q.coasterRail && q.x0 >= 6 && q.x1 < first)) notes.push('Ground before the first coaster section is skipped: the ride starts in the cart.');
  course.track = { pts: segments.flat(), ...(segments.length > 1 ? { segments } : {}), push };
  course.startX = first;
  return notes;
}

/** A coaster section as a piece, standing at (x, z); y lifts it off the ground. */
export function trackPiece(pts: TrackPts, at: { x: number; z: number }, y = 0): P {
  const p = newPiece('Coaster', trackMesh(pts), at), pos = p.mesh.positions as number[];
  // newPiece sets the lowest point of the smoothed curve on the floor, but the curve can dip below its lowest dot (a steep drop swings under it); the dots are what the game rides,
  // so lift the ribbon until the lowest dot sits on the floor and the black line in the side view runs through every dot (CC-244)
  const dip = Math.min(...smoothPts(pts).map((q) => q[1])) - Math.min(...pts.map((q) => q[1]));
  for (let i = 1; i < pos.length; i += 3) pos[i] += dip;
  return { ...p, src: trackSrc(pts), y };
}

/** No design limit on height (the Coaster builder has none): 1000 m is only a computer-safety value so the camera and the ribbon cannot break; the floor (the lane level) only blocks going lower (CC-244). */
export const TRACK_TOP = 1000;
export const clampTrackY = (y: number): number => Math.min(TRACK_TOP, Math.max(0, y));

export type TrackBlock = '' | 'floor' | 'ceiling' | 'spacing';
/** What the player is told when a drag is stopped, in plain words. */
export const TRACK_BLOCK_TEXT: Record<Exclude<TrackBlock, ''>, string> = {
  floor: 'ground level: a coaster point goes no lower',
  ceiling: 'highest point: a coaster point goes no higher',
  spacing: 'too close to the next dot',
};
export const TRACK_GAP = 0.5; // m: how close two dots of one section may be

/**
 * Where a dragged dot may go. `nx`, `ny` are the wanted place in the section's own numbers; `lift` is how high the section's lowest dot stands over the lane's ground (never below 0),
 * `scale` the section's size. The lowest dot never goes under the ground, no dot passes the ceiling, and dots keep their spacing; `block` says which one stopped the drag (CC-244).
 */
export function limitTrackPoint(pts: TrackPts, i: number, nx: number, ny: number, lift: number, scale: number, gap = TRACK_GAP): { x: number; y: number; block: TrackBlock } {
  const low0 = Math.min(...pts.map((q) => q[1])), floorY = Math.max(0, low0 - Math.max(0, lift) / scale);
  const lo = i > 0 ? pts[i - 1][0] + gap : -Infinity, hi = i < pts.length - 1 ? pts[i + 1][0] - gap : Infinity;
  const x = Math.min(hi, Math.max(lo, nx)), y = Math.min(TRACK_TOP, Math.max(floorY, ny)), eps = 0.005;
  const block: TrackBlock = ny < floorY - eps ? 'floor' : ny > TRACK_TOP + eps ? 'ceiling' : nx < lo - eps || nx > hi + eps ? 'spacing' : '';
  return { x, y, block };
}

/** The height of the rail at the end of a section piece (over the lane's level, before the lane is cut). */
export function trackEndY(p: P): number {
  const pts = parseTrackSrc(p.src ?? '');
  if (!pts) return p.y;
  return p.y + (pts[pts.length - 1][1] - Math.min(...pts.map((q) => q[1]))) * p.scale;
}

/** How far below the end of the section before a new section starts: the cart only has the height it began with, so every section after the first starts a little lower. */
export const TRACK_STEP_DOWN = 0.4;
export function trackStartY(prev: P | undefined, pts: TrackPts): number {
  if (!prev) return 0;
  return trackEndY(prev) - TRACK_STEP_DOWN - (pts[0][1] - Math.min(...pts.map((q) => q[1])));
}
