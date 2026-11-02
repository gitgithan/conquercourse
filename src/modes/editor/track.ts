import { isTrack, limitTrackPoint, parseTrackSrc, TRACK_TOP, type TrackBlock, sectionPoints, trackPiece, trackSrc } from '../../slice/track-world';
import type { EditorState, P } from './state';

// The coaster section's points in the side view: where the dots are, and what dragging or adding one does to the section.
// Moved out of editor.ts unchanged except that the editor state is the first argument (CC-133).
/** The points of the chosen coaster section in the side view: u along the run, y above the lane's level. */
export const trackDots = (ed: EditorState): { id: number; i: number; u: number; y: number }[] => {
  // every coaster section shows its dots, chosen or not: a click on the 3D picture (to turn the camera) clears the choice and must not hide them
  return ed.pieces.filter((q) => isTrack(q)).flatMap((p) => {
    const pts = parseTrackSrc(p.src ?? '');
    return pts ? sectionPoints(p, pts, p.x * Math.cos(ed.angle) + p.z * Math.sin(ed.angle), ed.level).map(([u, y], i) => ({ id: p.id, i, u, y, })) : [];
  });
};
/** Move point i of a section to (u, y) in the side view and keep every other point where it is. */
export function moveTrackPoint(ed: EditorState, p: P, i: number, u: number, y: number): TrackBlock {
  const pts = parseTrackSrc(p.src ?? ''); if (!pts) return '';
  const c = Math.cos(ed.angle), s = Math.sin(ed.angle), uc0 = p.x * c + p.z * s;
  const mid0 = (pts[0][0] + pts[pts.length - 1][0]) / 2, low0 = Math.min(...pts.map((q) => q[1]));
  const nx = (u - uc0) / p.scale + mid0, ny = (y - p.y + ed.level) / p.scale + low0;
  const lim = limitTrackPoint(pts, i, nx, ny, p.y - ed.level, p.scale);
  pts[i] = [lim.x, lim.y];
  const mid1 = (pts[0][0] + pts[pts.length - 1][0]) / 2, low1 = Math.min(...pts.map((q) => q[1]));
  const du = (mid1 - mid0) * p.scale, v = -p.x * s + p.z * c, uc1 = uc0 + du;
  p.x = uc1 * c - v * s; p.z = uc1 * s + v * c; p.y += (low1 - low0) * p.scale;
  p.src = trackSrc(pts); p.mesh = trackPiece(pts, { x: 0, z: 0 }).mesh;
  return lim.block;
}
/** Add a point to a section at (u, y) in the side view; the ends and every other point stay where they are. */
export function addTrackPoint(ed: EditorState, p: P, u: number, y: number): TrackBlock {
  const pts = parseTrackSrc(p.src ?? ''); if (!pts) return '';
  const c = Math.cos(ed.angle), uc0 = p.x * c + p.z * Math.sin(ed.angle);
  const mid0 = (pts[0][0] + pts[pts.length - 1][0]) / 2, low0 = Math.min(...pts.map((q) => q[1]));
  const nx = (u - uc0) / p.scale + mid0, wantY = (y - p.y + ed.level) / p.scale + low0;
  const floorY = Math.max(0, low0 - Math.max(0, p.y - ed.level) / p.scale), ny = Math.min(TRACK_TOP, Math.max(floorY, wantY));
  const k = pts.findIndex((q) => q[0] > nx);
  if (k <= 0 || nx - pts[k - 1][0] < 0.5 || pts[k][0] - nx < 0.5) return 'spacing';
  pts.splice(k, 0, [nx, ny]);
  p.y += (Math.min(...pts.map((q) => q[1])) - low0) * p.scale;
  p.src = trackSrc(pts); p.mesh = trackPiece(pts, { x: 0, z: 0 }).mesh;
  return wantY < floorY - 0.005 ? 'floor' : wantY > TRACK_TOP + 0.005 ? 'ceiling' : '';
}
