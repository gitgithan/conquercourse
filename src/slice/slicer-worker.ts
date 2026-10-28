import { bestSlices, CLIMBABLE, describe, laneSamples, laneToCourse, sliceProfile, surfaceSamples, type Candidate, type Profile } from './slice';
import { LANE_DROP } from '../sim/drop';
import { gapSpecs } from '../sim/needs';
import { searchIdealRun } from '../sim/ideal';
import { laneFacts, looksCrossable, type LaneFacts } from './why';

// Cuts the lane for one cut height off the page's thread (the Slicer, CC-73). Two answers: the best lane by its shape at once,
// then, when the simulator has tried to clear it, the best lane it can clear (or none).
// CC-92: a lane carries its facts (widest gap, tallest step, fall) so the page can say why it cannot be cleared, and a "strip" ask
// looks at many heights at once (shape only, no simulator proof) so the slider can show where a lane looks crossable.
export interface SliceAsk { id: number; positions: number[]; indices: number[]; level: number; strip?: number[]; custom?: { angle: number; offset: number } } // custom: the player's own line (CC-93), the turn and the sideways step in the shrunk place
export interface LaneSummary { angle: number; offset: number; origin: number; length: number; score: number; facts?: LaneFacts }
export interface StripRow { level: number; lane: boolean; facts?: LaneFacts; crossable?: boolean }
export type SliceAnswer = { id: number; phase: 'quick' | 'proved'; lane: LaneSummary | null } | { id: number; phase: 'strip'; rows: StripRow[] };

const ctx = self as unknown as { onmessage: ((e: { data: SliceAsk }) => void) | null; postMessage(m: SliceAnswer): void };
const summary = (c: Candidate, profile: Profile = c.profile): LaneSummary => ({ angle: c.angle, offset: c.offset, origin: profile.origin ?? 0, length: profile.length, score: c.report.score, facts: laneFacts(profile) });

ctx.onmessage = (e) => {
  const { id, positions, indices, level, strip, custom } = e.data;
  if (strip) {
    const coarse = surfaceSamples({ positions, indices }, 20); // heights only need the shape of the lane, not a proof: much lighter than the lane search
    const rows: StripRow[] = [];
    for (const lv of strip) {
      // the best-looking lane is often not the one the simulator can clear: look at the first few and say "looks crossable" if any of them does
      const found = bestSlices({ positions: coarse }, { levels: [lv], top: 8, prove: false, centre: { x: 0, z: 0 } });
      if (!found.length) { rows.push({ level: lv, lane: false }); continue; }
      let pick: { facts: LaneFacts; ok: boolean } | null = null;
      for (const cand of found) {
        const facts = laneFacts(sliceProfile(laneSamples({ positions, indices }, cand, { x: 0, z: 0 }, 120), { x: 0, z: 0 }, cand));
        const ok = looksCrossable(facts);
        if (!pick || (ok && !pick.ok)) pick = { facts, ok };
        if (ok) break;
      }
      rows.push({ level: lv, lane: true, facts: pick!.facts, crossable: pick!.ok });
    }
    ctx.postMessage({ id, phase: 'strip', rows });
    return;
  }
  if (custom) { // the player's own line: read it the way the editor will, say what is on it, and try to clear it
    const o = { angle: custom.angle, offset: custom.offset, level };
    const prof = sliceProfile(laneSamples({ positions, indices }, o, { x: 0, z: 0 }), { x: 0, z: 0 }, o);
    const rep = prof.length >= 1 ? describe(prof) : null;
    const sum: LaneSummary | null = rep ? { angle: o.angle, offset: o.offset, origin: prof.origin ?? 0, length: prof.length, score: rep.score, facts: laneFacts(prof) } : null;
    ctx.postMessage({ id, phase: 'quick', lane: sum });
    let clear = false;
    if (rep && prof.length >= 8 && rep.maxRise <= CLIMBABLE && rep.maxDrop <= LANE_DROP) {
      const course = laneToCourse({ cells: [...prof.cells], length: prof.length });
      clear = !gapSpecs(course).some((g) => g.needed > 8.5) && searchIdealRun(course).cleared;
    }
    ctx.postMessage({ id, phase: 'proved', lane: clear ? sum : null });
    return;
  }
  const samples = surfaceSamples({ positions, indices }, 80); // lighter than the default: a district is big
  const opts = { levels: [level], top: 1, centre: { x: 0, z: 0 } };
  const quick = bestSlices({ positions: samples }, { ...opts, prove: false });
  ctx.postMessage({ id, phase: 'quick', lane: quick[0] ? summary(quick[0]) : null });
  if (!quick[0]) { ctx.postMessage({ id, phase: 'proved', lane: null }); return; }
  // the proof reads the lane the way the editor will (CC-91): densely along the lane, not from the lighter points the search used
  const proved = bestSlices({ positions: samples }, { ...opts, maxProofs: 4, reprofile: (c) => sliceProfile(laneSamples({ positions, indices }, c), { x: 0, z: 0 }, c) });
  ctx.postMessage({ id, phase: 'proved', lane: proved[0] ? summary(proved[0]) : null });
};
