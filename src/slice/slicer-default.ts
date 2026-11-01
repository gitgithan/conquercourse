// CC-90: the Slicer's proven default for a prepared place, as plain functions.
// The page, the offline search (scripts/slicer-defaults.ts) and the tests all call these, so "the stored line clears" means exactly what the live check means.
// The check is the Slicer's own player-line check (customLane): it reads the lane from the very pieces the editor gets, then runs the ideal-run search on the real simulator.
import { buildingsFrom, extrude, type OverpassAnswer } from '../world/osm';
import { buildingTops, cutRange, piecesFrom, type MapPiece, type Top } from './slicer';
import { customLane, worldOf } from './slicer-core';
import { laneToCourse } from './slice';
import { laneProfile } from './world';
import { searchIdealRun, playPlan } from '../sim/ideal';
import type { Ground } from '../world/terrain';

/** Bump when the lane check or the piece reading changes: a stored default from an older version is re-verified before it is trusted. */
export const CHECK_VERSION = 2; // 2: roof start is on (CC-200), and a lane search that fails its first 4 proofs tries 40
export const TICKS_PER_SECOND = 80;

export type Line = [number, number, number, number]; // x0, z0, x1, z1 in real metres east and south of the pin

export interface SlicerDefault {
  slug: string;
  clear: boolean; // true: the real simulator cleared this line at this height
  shrink: number; // the Shrink slider
  cutM: number; // the Cut height slider, real metres (a multiple of the slider's 0.5 step)
  line: Line; // the lane's two ends, the same line the player can drag
  lengthM: number; // the lane's length in the game
  clearS: number | null; // seconds the ideal run took to finish the lane (null when it did not clear)
  checkVersion: number;
  note?: string; // when clear is false: why, in plain words; the line is then the closest attempt
}
export interface DefaultsFile { version: number; checkVersion: number; places: SlicerDefault[] }

export interface PlaceInput { answer: OverpassAnswer; lat: number; lon: number; ground: Ground | null }
export interface SliceStateAt { tops: Top[]; mesh: { positions: number[]; indices: number[] }; pieces: MapPiece[]; range: number }

/** The place at shrink k with these buildings picked (all of them when `picked` is left out): the roofs, the mesh and the pieces. */
export function stateAt(p: PlaceInput, k: number, picked?: ReadonlySet<number>): SliceStateAt {
  const bs = buildingsFrom(p.answer, p.lat, p.lon), tops = buildingTops(bs, k, p.ground);
  const keep = picked ?? new Set(tops.keys());
  const m = extrude(tops.filter((_, i) => keep.has(i)).map((t) => t.b), k, p.ground);
  return { tops, mesh: { positions: m.positions, indices: m.indices }, pieces: piecesFrom(tops, keep, k, p.ground), range: cutRange(tops, p.ground) };
}

/** The player's line as the turn and the sideways step in the shrunk place. */
export function customOf(t: readonly [readonly [number, number], readonly [number, number]], k: number): { angle: number; offset: number } {
  let angle = Math.atan2(t[1][1] - t[0][1], t[1][0] - t[0][0]);
  if (angle < 0) angle += Math.PI;
  if (angle >= Math.PI) angle -= Math.PI;
  return { angle, offset: (t[0][0] * -Math.sin(angle) + t[0][1] * Math.cos(angle)) * k };
}
export const tourOf = (l: Line): [[number, number], [number, number]] => [[l[0], l[1]], [l[2], l[3]]];

export interface Replay { cleared: boolean; lengthM: number; clearS: number | null; angle: number; offset: number; level: number }

/** Replay one default on the real simulator, the way the Slicer checks the player's own line. */
export function replayDefault(d: Pick<SlicerDefault, 'shrink' | 'cutM' | 'line'>, p: PlaceInput, withTime = false): Replay {
  const st = stateAt(p, d.shrink), own = customOf(tourOf(d.line), d.shrink), level = d.cutM * d.shrink;
  const r = customLane({ mesh: st.mesh, pieces: st.pieces }, { angle: own.angle, offset: own.offset, level });
  const len = r.quick?.length ?? 0;
  if (!r.proved || !withTime) return { cleared: !!r.proved, lengthM: len, clearS: null, ...own, level };
  const prof = laneProfile(worldOf(st.pieces), { angle: own.angle, offset: own.offset, level });
  const course = laneToCourse({ cells: [...prof.cells], length: prof.length });
  const res = searchIdealRun(course);
  const run = playPlan(course, res.plan);
  return { cleared: res.cleared, lengthM: len, clearS: res.cleared ? Math.round((run.world.runner.tick / TICKS_PER_SECOND) * 10) / 10 : null, ...own, level };
}

/** Does a stored default apply to the page's state? (same version of the check, and clear). */
export const trusted = (d: SlicerDefault | undefined | null): d is SlicerDefault => !!d && d.clear && d.checkVersion === CHECK_VERSION;

/** What the Slicer opens with: a prepared place's stored default when there is one, else the plain start (the person's shrink, a cut at 35% of the range, no line yet). */
export interface Opening { shrink: number; cutM: number; line: Line | null; proven: boolean; closest: boolean }
export function openingFor(d: SlicerDefault | undefined | null, plain: { shrink: number; range: number }): Opening {
  if (d && (d.clear || d.lengthM > 0)) {
    const cutM = Math.max(0, Math.min(plain.range, d.cutM));
    return { shrink: d.shrink, cutM, line: d.line, proven: trusted(d), closest: !d.clear };
  }
  return { shrink: plain.shrink, cutM: Math.round(plain.range * 0.35 * 2) / 2, line: null, proven: false, closest: false };
}

/** The lane summary the Slicer shows at once for a proven default (the same shape the worker answers with). */
export function provenSummary(d: Pick<SlicerDefault, 'shrink' | 'line' | 'lengthM'>): { angle: number; offset: number; origin: number; length: number; score: number } {
  const own = customOf(tourOf(d.line), d.shrink), c = Math.cos(own.angle), s = Math.sin(own.angle);
  const u = (x: number, z: number) => (x * c + z * s) * d.shrink;
  return { angle: own.angle, offset: own.offset, origin: Math.min(u(d.line[0], d.line[1]), u(d.line[2], d.line[3])), length: d.lengthM, score: 0 };
}

/** The same line, within the 0.1 m the file is rounded to. */
export const sameLine = (a: Line, b: Line): boolean => a.every((v, i) => Math.abs(v - b[i]) <= 0.15);
