import { adviseLane, type Change, type LaneSetting } from './advice';
import { bestSlices, laneToCourse, sliceProfile } from './slice';
import { realSize, worldSamples, type Piece } from './world';
import { clearedCached, meter, workSeconds } from '../sim/ideal';
import type { CourseData } from '../course/course';

// "Fix it": change the layout, right now, into one the simulator can clear. It applies the smallest proved fix again and again
// (each one checked by the ideal-run search), shrinks a step no jump can climb, and as a last resort takes the best lane the slice search finds.
export interface Fixed { ok: boolean; pieces: Piece[]; lane: LaneSetting; steps: string[] }

export const clears = (ps: Piece[], l: LaneSetting, wrap?: (c: CourseData) => CourseData): boolean => {
  const pr = sliceProfile(worldSamples(ps), { x: 0, z: 0 }, l);
  if (pr.length < 8) return false;
  const course = laneToCourse({ cells: [...pr.cells], length: pr.length, origin: pr.origin });
  return clearedCached(wrap ? wrap(course) : course);
};

const applyChange = (ps: Piece[], l: LaneSetting, id: number | undefined, c: Change): { ps: Piece[]; lane: LaneSetting } => ({
  ps: ps.map((p) => (p.id === id ? { ...p, x: p.x + (c.dx ?? 0), z: p.z + (c.dz ?? 0), y: Math.max(0, p.y + (c.dy ?? 0)), scale: c.scale ?? p.scale, yaw: p.yaw + (c.yaw ?? 0) } : p)),
  lane: { angle: c.angle ?? l.angle, offset: c.offset ?? l.offset, level: c.level ?? l.level },
});

export function fixLayout(pieces: Piece[], lane: LaneSetting, budget = workSeconds(12), wrap?: (c: CourseData) => CourseData): Fixed { // budget in simulated ticks, so the answer does not depend on the machine's speed
  const t0 = meter.ticks;
  let ps = pieces.map((p) => ({ ...p }));
  let l = { ...lane };
  const steps: string[] = [];
  for (let round = 0; round < 6 && meter.ticks - t0 < budget; round++) {
    if (clears(ps, l, wrap)) return { ok: true, pieces: ps, lane: l, steps };
    const adv = adviseLane(ps, l, { budget: workSeconds(0.9), max: 1, wrap });
    if (adv.length) { const a = adv[0]; ({ ps, lane: l } = applyChange(ps, l, a.piece, a.change)); steps.push(a.text); continue; }
    // no single small shift works: shrink the tallest thing that no jump could climb
    const tall = wrap ? undefined : ps.filter((p) => { const r = realSize(p); return r.h + p.y > 1.0; }).sort((a, b) => realSize(b).h - realSize(a).h)[0];
    if (!tall) break;
    const r = realSize(tall);
    const k = 0.9 / (r.h + tall.y);
    ps = ps.map((p) => (p.id === tall.id ? { ...p, scale: p.scale * k, y: p.y * k } : p));
    steps.push(`Made "${tall.name}" smaller (${(r.h + tall.y).toFixed(1)} m down to 0.9 m high), the most one jump can climb.`);
  }
  if (clears(ps, l, wrap)) return { ok: true, pieces: ps, lane: l, steps };
  // last resort: the best lane through the world as it is now
  const found = bestSlices({ positions: Array.from(worldSamples(ps)) }, { top: 1, levels: [l.level], centre: { x: 0, z: 0 } });
  if (found.length) { l = { angle: found[0].angle, offset: found[0].offset, level: found[0].level }; steps.push('Turned the lane to the best line through the pieces.'); }
  return { ok: clears(ps, l, wrap), pieces: ps, lane: l, steps };
}
