// The Slicer's check, as plain functions (CC-179): the worker, the build script and the tests all call these, so the preview and the
// built course cannot drift apart. The proof reads the lane from the very pieces "Build the picked buildings" hands to the editor
// (src/slice/world.ts laneProfile), and the editor reads it the same way, so a lane the preview clears is the lane the editor gets.
import { bestSlices, CLIMBABLE, describe, laneToCourse, sliceProfile, surfaceSamples, laneSamples, type Candidate, type Mesh, type Profile, type SliceOptions } from './slice';
import { LANE_DROP } from '../sim/drop';
import { searchIdealRun } from '../sim/ideal';
import { laneFacts, looksCrossable, type LaneFacts } from './why';
import { laneProfile, newPiece, type Piece } from './world';
import type { MapPiece } from './slicer';

export interface LaneSummary { angle: number; offset: number; origin: number; length: number; score: number; facts?: LaneFacts }
const summary = (c: Candidate, profile: Profile = c.profile): LaneSummary => ({ angle: c.angle, offset: c.offset, origin: profile.origin ?? 0, length: profile.length, score: c.report.score, facts: laneFacts(profile) });

// the world the editor will hold: one piece per picked building, where it stood (the same lines as the editor's hand-over)
export const worldOf = (pieces: MapPiece[]): Piece[] => pieces.map((q) => ({ ...newPiece(q.name, { positions: q.positions, indices: q.indices }), x: q.x, z: q.z }));

export interface Place { mesh: Mesh & { positions: ArrayLike<number> }; pieces: MapPiece[] }

export function quickLane(place: Place, level: number): LaneSummary | null {
  const samples = surfaceSamples(place.mesh, 80); // lighter than the default: a district is big
  const quick = bestSlices({ positions: samples }, { levels: [level], top: 1, prove: false, centre: { x: 0, z: 0 } });
  return quick[0] ? summary(quick[0]) : null;
}

// the best lane the simulator can clear at this level, read from the editor's pieces
export function provedLane(place: Place, level: number): LaneSummary | null {
  const samples = surfaceSamples(place.mesh, 80), world = worldOf(place.pieces);
  const proved = bestSlices({ positions: samples }, { levels: [level], top: 1, centre: { x: 0, z: 0 }, maxProofs: 4, reprofile: (c) => laneProfile(world, c) });
  return proved[0] ? summary(proved[0]) : null;
}

// the player's own line (CC-93): what is on it, and whether the simulator clears it
export function customLane(place: Place, o: SliceOptions): { quick: LaneSummary | null; proved: LaneSummary | null } {
  const prof = laneProfile(worldOf(place.pieces), o);
  const rep = prof.length >= 1 ? describe(prof) : null;
  const sum: LaneSummary | null = rep ? { angle: o.angle, offset: o.offset, origin: prof.origin ?? 0, length: prof.length, score: rep.score, facts: laneFacts(prof) } : null;
  let clear = false;
  if (rep && prof.length >= 8 && rep.maxRise <= CLIMBABLE && rep.maxDrop <= LANE_DROP) {
    const course = laneToCourse({ cells: [...prof.cells], length: prof.length });
    clear = searchIdealRun(course).cleared; // no shortcut gate here: the editor runs this very search, so the answers must match
  }
  return { quick: sum, proved: clear ? sum : null };
}

// kept only so old callers that have no pieces yet still work (a lane cut from the one big mesh)
export const meshProfile = (mesh: Mesh, c: SliceOptions): Profile => sliceProfile(laneSamples(mesh, c), { x: 0, z: 0 }, c);

// CC-92: many heights at once, shape only (no simulator proof): the strip of heights under the slider
export interface StripRow { level: number; lane: boolean; facts?: LaneFacts; crossable?: boolean }
export function stripRows(mesh: Mesh, levels: number[]): StripRow[] {
  const coarse = surfaceSamples(mesh, 20); // heights only need the shape of the lane, not a proof: much lighter than the lane search
  const rows: StripRow[] = [];
  for (const lv of levels) {
    // the best-looking lane is often not the one the simulator can clear: look at the first few and say "looks crossable" if any of them does
    const found = bestSlices({ positions: coarse }, { levels: [lv], top: 8, prove: false, centre: { x: 0, z: 0 } });
    if (!found.length) { rows.push({ level: lv, lane: false }); continue; }
    let pick: { facts: LaneFacts; ok: boolean } | null = null;
    for (const cand of found) {
      const facts = laneFacts(sliceProfile(laneSamples(mesh, cand, { x: 0, z: 0 }, 120), { x: 0, z: 0 }, cand));
      const ok = looksCrossable(facts);
      if (!pick || (ok && !pick.ok)) pick = { facts, ok };
      if (ok) break;
    }
    rows.push({ level: lv, lane: true, facts: pick!.facts, crossable: pick!.ok });
  }
  return rows;
}

// CC-202: one honest answer to "does this height give a path?" for the state on the screen (same pieces, same shrink, and the player's own line when there is one).
// The strip and every offered fix use it, so a green height or a fix button can only be shown when the very check behind the "a path exists" line said yes.
export type OwnLine = { angle: number; offset: number };
export function pathAt(place: Place, level: number, own?: OwnLine): boolean {
  if (own) return !!customLane(place, { angle: own.angle, offset: own.offset, level }).proved;
  return !!provedLane(place, level);
}
