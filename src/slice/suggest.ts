// When the slicer finds no path: ONE plain reason and 1 to 3 ranked fixes, from built-in rules on the lane facts (CC-179).
// No language model: the rules are instant, work offline, give the same answer every time, and can only name controls that exist on the panel
// (cut height, shrink, picked buildings, the line's dots). Pure maths, so the page and the tests share it.
import { LANE_DROP } from '../sim/drop';
import { CLIMBABLE } from './slice';
import { JUMP_GAP_M, type LaneFacts } from './why';

export type SuggestAction =
  | { kind: 'cut'; value: number } // set the cut height (real metres) and check again
  | { kind: 'shrink'; value: number } // set the shrink and check again
  | { kind: 'pickall' } // put every building back
  | { kind: 'drag' }; // no button: turn or move the line with its white dots
export interface Suggestion { text: string; button: string; action: SuggestAction }
export interface StripCell { real: number; lane: boolean; crossable?: boolean }
export interface WhyInput {
  facts: LaneFacts | null; // the lane the shape search found (null: it found none)
  k: number; // shrink now
  cut: number; // cut height now, real metres
  strip: StripCell[]; // the heights strip (shape only), may be empty while it is still working
  picked: number; total: number;
}
export interface WhyAnswer { reason: string; kind: 'none' | 'short' | 'wall' | 'drop' | 'gap' | 'other'; suggestions: Suggestion[] }

const m1 = (v: number) => (Math.round(v * 10) / 10).toString();
const round2 = (v: number) => Math.round(v * 100) / 100;
const MIN_SHRINK = 0.03;

const GIVE_UP = 'No cut or shrink helps here, pick another place.';

export function explainNoPath(i: WhyInput): WhyAnswer {
  const r = explainRaw(i);
  if (!r.suggestions.some((x) => x.action.kind !== 'drag')) r.reason = `${r.reason} ${GIVE_UP}`;
  return r;
}

function explainRaw(i: WhyInput): WhyAnswer {
  const f = i.facts;
  const out: Suggestion[] = [];
  const near = i.strip.filter((c) => c.crossable && Math.abs(c.real - i.cut) > 0.01).sort((a, b) => Math.abs(a.real - i.cut) - Math.abs(b.real - i.cut))[0];
  const withLane = i.strip.filter((c) => c.lane && Math.abs(c.real - i.cut) > 0.01).sort((a, b) => Math.abs(a.real - i.cut) - Math.abs(b.real - i.cut))[0];
  const cutFix = (c: StripCell | undefined, why: string) => { if (c) out.push({ text: `Cut at ${c.real} m, ${why}.`, button: `Cut at ${c.real} m`, action: { kind: 'cut', value: c.real } }); };
  const shrinkFix = (factor: number, why: string) => {
    const v = round2(Math.max(MIN_SHRINK, i.k * Math.min(0.85, factor)));
    if (v < i.k - 0.004) out.push({ text: `Shrink more, ${i.k} to ${v} (${why}).`, button: `Shrink to ${v}`, action: { kind: 'shrink', value: v } });
  };
  const putBack = () => { if (i.picked < i.total) out.push({ text: `Put the ${i.total - i.picked} left-out buildings back (they may fill the gap).`, button: 'Pick all', action: { kind: 'pickall' } }); };
  const drag = () => out.push({ text: 'Drag the white dots to run along a different street.', button: '', action: { kind: 'drag' } });

  if (!f) {
    cutFix(near ?? withLane, 'it has a lane');
    shrinkFix(0.6, 'walls and falls shrink with it');
    putBack();
    return { kind: 'none', reason: 'No lane: every line meets a wall too tall to climb, a fall too long, or too little to run on.', suggestions: out.slice(0, 3) };
  }
  if (f.lengthM < 8) {
    cutFix(near ?? withLane, 'longer lane');
    putBack();
    drag();
    return { kind: 'short', reason: `The lane is ${m1(f.lengthM)} m, too short to run on (needs 8 m).`, suggestions: out.slice(0, 3) };
  }
  if (f.tallestStepM > CLIMBABLE) {
    cutFix(near, 'lower walls there');
    shrinkFix((CLIMBABLE * 0.85) / f.tallestStepM, 'walls get lower');
    drag();
    return { kind: 'wall', reason: `Tallest wall ${m1(f.tallestStepM)} m, the runner climbs ${m1(CLIMBABLE)} m.`, suggestions: out.slice(0, 3) };
  }
  if (f.deepestDropM > LANE_DROP) {
    cutFix(near, 'smaller falls there');
    shrinkFix((LANE_DROP * 0.85) / f.deepestDropM, 'falls get shorter');
    drag();
    return { kind: 'drop', reason: `Longest fall ${m1(f.deepestDropM)} m, the runner survives ${m1(LANE_DROP)} m.`, suggestions: out.slice(0, 3) };
  }
  const gap = Math.max(f.widestGapM, f.hardGapM);
  if (gap > JUMP_GAP_M || f.needsSpeed > 8.5) {
    cutFix(near, 'this lane can be crossed');
    shrinkFix((JUMP_GAP_M * 0.8) / gap, 'gaps get narrower');
    putBack();
    drag();
    const rise = f.hardRiseM > 0.3 ? `, far side ${m1(f.hardRiseM)} m higher` : '';
    return { kind: 'gap', reason: f.widestGapM > JUMP_GAP_M ? `Widest gap ${m1(f.widestGapM)} m, the runner clears about ${JUMP_GAP_M} m.` : `Hardest jump: ${m1(f.hardGapM)} m wide${rise}, more than top speed clears.`, suggestions: out.slice(0, 3) };
  }
  // every number is in range, yet no path: usually a tiny ledge to land on or a step right after a gap
  cutFix(near ?? withLane, 'a different lane');
  drag();
  shrinkFix(0.75, 'ledges and gaps get smaller');
  return { kind: 'other', reason: `Nothing is too big (widest gap ${m1(f.widestGapM)} m, tallest wall ${m1(f.tallestStepM)} m), but the runner found no path, often a landing that is too small.`, suggestions: out.slice(0, 3) };
}
