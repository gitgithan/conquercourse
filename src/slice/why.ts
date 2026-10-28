// Why a cut height gives no lane, in plain words (CC-92): the widest gap against what a run and jump crosses, the tallest step against a climb, the fall against a roll.
// Pure maths on a lane profile; the Slicer shows the lines and a strip of heights, and every number comes from the same profile the simulator reads.
import { LANE_DROP } from '../sim/drop';
import { gapSpecs } from '../sim/needs';
import { CELL, CLIMBABLE, laneToCourse, type Profile } from './slice';

export const JUMP_GAP_M = 8; // a plain run and jump clears about this much (docs/world-slice.md: the ideal run reaches 8 m on flat ground)
export const BAND_GAP_M = 14; // the band demo throws across a 10 m gap and the throw lands in the water below about 14 m of stretch
export const MIN_GAP_M = 1.2; // a crack narrower than this is bridged: nobody jumps a crack

export interface LaneFacts {
  lengthM: number;
  widestGapM: number; // the widest hole the runner must cross
  tallestStepM: number; // the tallest wall or step going up
  deepestDropM: number; // the longest fall going down
  solidShare: number; // the share of the lane that has ground under it (0 to 1)
  needsSpeed: number; // the fastest run-up any gap needs (m/s); the runner tops out near 9
  hardGapM: number; // the width of the gap that needs that speed
  hardRiseM: number; // and how much higher its far side is (negative: lower)
}
export const laneFacts = (p: Profile): LaneFacts => {
  const c = p.cells;
  let gapRun = 0, widest = 0, lastGround = -1, lastH: number | null = null, rise = 0, drop = 0, solid = 0;
  for (let i = 0; i < c.length; i++) {
    const h = c[i];
    if (h === null) { gapRun++; continue; }
    if (lastGround >= 0 && gapRun * CELL >= MIN_GAP_M) widest = Math.max(widest, gapRun * CELL);
    gapRun = 0; solid++;
    if (lastH !== null) { rise = Math.max(rise, h - lastH); drop = Math.max(drop, lastH - h); }
    lastH = h; lastGround = i;
  }
  let needs = 0, hardGap = 0, hardRise = 0;
  if (c.length >= 8) {
    try { for (const g of gapSpecs(laneToCourse({ cells: [...c], length: p.length }))) if (g.needed > needs || (g.needed === needs && g.width > hardGap)) { needs = g.needed; hardGap = g.width; hardRise = g.rise; } } catch { needs = 0; }
  }
  return { lengthM: p.length, widestGapM: widest, tallestStepM: rise, deepestDropM: drop, solidShare: c.length ? solid / c.length : 0, needsSpeed: needs, hardGapM: hardGap, hardRiseM: hardRise };
};

// A first look at whether a lane can be crossed at all with a plain run, jump, vault, climb and roll (the real answer is the simulator proof).
export const looksCrossable = (f: LaneFacts): boolean => f.lengthM >= 8 && f.tallestStepM <= CLIMBABLE && f.deepestDropM <= LANE_DROP && f.needsSpeed <= 8.5 && f.widestGapM <= JUMP_GAP_M + 0.5; // a Slicer lane has no bars or devices, so a gap wider than a run and jump is not crossable

export interface Why { lines: string[]; blocked: 'gap' | 'wall' | 'drop' | 'short' | 'none' }
const m1 = (v: number) => (Math.round(v * 10) / 10).toString();
export function whyNot(f: LaneFacts): Why {
  if (f.lengthM < 8) return { blocked: 'short', lines: ['The lane here is shorter than 8 m, too short to run along.', 'Try another height, or move the line over more buildings.'] };
  const lines: string[] = [];
  let blocked: Why['blocked'] = 'none';
  if (f.tallestStepM > CLIMBABLE) { blocked = 'wall'; lines.push(`A wall on this lane is ${m1(f.tallestStepM)} m tall. A climb reaches about ${m1(CLIMBABLE)} m.`); }
  if (f.deepestDropM > LANE_DROP) { if (blocked === 'none') blocked = 'drop'; lines.push(`A fall on this lane is ${m1(f.deepestDropM)} m. A roll survives about ${m1(LANE_DROP)} m.`); }
  if (f.needsSpeed > 8.5 || f.widestGapM > JUMP_GAP_M) {
    if (blocked === 'none') blocked = 'gap';
    const w = f.widestGapM;
    if (w > JUMP_GAP_M) {
      lines.push(`The widest gap is ${m1(w)} m. A run and jump clears about ${JUMP_GAP_M} m.`);
      lines.push(w <= BAND_GAP_M ? 'A band or a swing between bars could carry you across a gap this wide.' : 'A gap this wide needs a cannon or a drone.');
    } else {
      lines.push(`The hardest jump is a gap of ${m1(f.hardGapM)} m${f.hardRiseM > 0.3 ? ` with the far side ${m1(f.hardRiseM)} m higher` : ''}. A runner would need to be faster than the top speed (about 9 m/s) to clear it.`);
      lines.push('Narrow that gap, lower its far side, or look for a band, a swing between bars or a climb.');
    }
  }
  return { blocked, lines };
}
