import type { CourseData } from '../course/course';
import type { Branch } from '../sim/branches';
import { BULB_BAND_LO } from '../sim/fork';
import type { Mesh } from './slice';
import { HALF_LANE } from './slice';
import { newPiece, type Piece } from './world';

// A climbing pole in the editor (CC-133, behind ?fork=1): a piece whose src is "pole:<top>" stands on the ground, <top> metres tall.
// It is not ground (noGround). In the course it becomes a climbPole whose top hands over to the first bar after it; the floor between the pole and the
// next ground after the last bar becomes the "bench" way, the pole and the bars the "bulb" way (src/sim/fork.ts proves both).
export type P = Piece & { src?: string };
export const POLE_PREFIX = 'pole:';
export const POLE_TOP_MIN = 2.5, POLE_TOP_MAX = 5;
export const DEFAULT_POLE_TOP = 4.3;
export const poleSrc = (top: number): string => `${POLE_PREFIX}${top}`;
export const isPolePiece = (p: { src?: string }): boolean => !!p.src?.startsWith(POLE_PREFIX);
export const poleTopOf = (src: string | undefined): number => {
  const n = Number(src?.slice(POLE_PREFIX.length));
  return Math.max(POLE_TOP_MIN, Math.min(POLE_TOP_MAX, Number.isFinite(n) && n > 0 ? n : DEFAULT_POLE_TOP));
};
export function poleMesh(top: number): Mesh {
  const [x0, x1, y0, y1, z0, z1] = [-0.06, 0.06, 0, top, -0.06, 0.06];
  const q = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2];
  return { positions: [x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1], indices: q };
}
export function polePiece(top: number, at: { x: number; z: number }, y = 0): P {
  const p: P = { ...newPiece('Pole', poleMesh(top), at), src: poleSrc(top), y };
  p.noGround = true;
  return p;
}
/** The poles inside the lane: u along the run, top height over the ground. */
export function polesOf(pieces: P[], lane: { angle: number; offset: number; level: number }): { u: number; top: number }[] {
  const c = Math.cos(lane.angle), s = Math.sin(lane.angle);
  return pieces.filter(isPolePiece).flatMap((p) => {
    const u = p.x * c + p.z * s, v = -p.x * s + p.z * c - lane.offset;
    return Math.abs(v) <= HALF_LANE + 0.5 ? [{ u, top: poleTopOf(p.src) + p.y - lane.level }] : [];
  }).sort((a, b) => a.u - b.u);
}

/** The course with its poles: each pole hands over to the first bar after it, and when there is floor under the bars a fork is made (bench way and bulb way). */
export function withPoles(course: CourseData, poles: { x: number; top: number }[]): CourseData {
  const holds = course.holds ?? [];
  const out: CourseData = { ...course };
  const cps = poles.flatMap((p) => { const i = holds.findIndex((h) => h.x > p.x); return i < 0 ? [] : [{ x: round(p.x), top: round(p.top), toHold: i }]; });
  if (!cps.length) return course;
  (out as { climbPoles?: unknown }).climbPoles = cps;
  delete out.jumpKeep; // the editor's bars make every jump cost speed (jumpKeep), which a floor lane across a 3 m start gap cannot pay; a pole course keeps full jumps
  const p0 = cps[0], plats = course.terrain.platforms;
  const forkX = round(p0.x + 0.3), lastBar = holds[holds.length - 1].x;
  const join = plats.filter((q) => q.x0 > lastBar).sort((a, b) => a.x0 - b.x0)[0];
  if (!join || cps.length > 1) return out; // one pole makes one fork
  const own = plats.flatMap((q, i) => (q.x0 >= forkX && q.x1 <= join.x0 ? [i] : []));
  if (!own.length) return out;
  const branch: Branch = {
    id: 'fork', name: 'The fork: benches or bulbs', forkX, joinX: join.x0,
    routes: [
      { id: 'bench', name: 'Bench lane: run and jump the floor', band: [-1e9, BULB_BAND_LO], own: { platforms: own }, icons: ['step', 'vault', 'step'] },
      { id: 'bulb', name: 'Bulb lane: climb the pole, swing the bars', band: [BULB_BAND_LO, 1e9], own: { holds: holds.map((_, i) => i).filter((i) => i >= p0.toHold), poles: [0] }, icons: ['climb', 'lache'] },
    ],
  };
  (out as { branches?: unknown }).branches = [branch];
  return out;
}
const round = (v: number) => Math.round(v * 100) / 100;
