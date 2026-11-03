// "Mark it yourself", the cut-out preview (CC-133, owner principle 2026-11-03): segment first, show the player what would be lifted, then let the player choose.
// A marked box is sent to the finder for a cut-out (on the blurred photo only). The player sees it, then presses "Use this" or "Redraw".
// Nothing is lifted, ticked or paid for until the player has pressed "Use this". Pure rules, no page code, so they are tested without a browser (tests/markpreview.test.ts).
import { coversPerson, type Box } from './markbox';

/** What the page holds for a marked thing: the box the player drew, the finder's cut-out, and whether the player confirmed it. */
export interface MarkedCut { label: string; box: Box; cutout?: string; marked?: boolean; confirmed?: boolean }

const area = (b: Box): number => Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);
const overlap = (a: Box, b: Box): number => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));

/** The cut-out must fill at least this share of the box the player drew, or it is a speck. */
export const CUT_MIN_SHARE = 0.08;
/** At least this share of the cut-out must lie inside the drawn box (the finder may reach a little outside, not far). */
export const CUT_INSIDE = 0.6;

/** A plain reason the cut-out should not be offered, or '' when the player may look at it and choose. */
export function cutProblem(drawn: Box, cut: { box: Box; cutout?: string } | null, people: Box[]): string {
  if (!cut || !cut.cutout || area(cut.box) <= 0) return 'The finder could not outline a clear shape in that box. Draw it again, a little tighter round the thing.';
  if (area(cut.box) < CUT_MIN_SHARE * area(drawn) || overlap(cut.box, drawn) < CUT_INSIDE * area(cut.box)) return 'The finder outlined something else. Draw the box again round just the thing.';
  if (coversPerson(cut.box, people)) return 'The outline lands on a person, and people are never used. Draw the box away from the person.';
  return '';
}

/** A marked thing waits for the player; every other thing (a finder outline) is the player's pick as soon as it is ticked. */
export const awaitsConfirm = (c: MarkedCut): boolean => !!c.marked && !c.confirmed;
/** Only a confirmed marked thing, or a finder outline, may be ticked. */
export const canTick = (c: MarkedCut): boolean => !awaitsConfirm(c);
/** The ticks that may go on to the lift: a tick on a thing the player has not confirmed is dropped, always. */
export const liftable = (cands: MarkedCut[], ticked: number[]): number[] => ticked.filter((i) => cands[i] !== undefined && canTick(cands[i]));
/** A thing the player confirmed after seeing its cut-out. */
export const confirm = <T extends MarkedCut>(c: T): T => ({ ...c, confirmed: true });

/** The reply of one box-mask call: exactly one item, or none. Anything odd gives null. */
export function oneCut(items: { box: Box; cutout: string }[]): { box: Box; cutout: string } | null {
  return items.length >= 1 && items[0].cutout ? items[0] : null;
}

/** The request check for the box part of /api/segment: a box of 4 whole-ish numbers, or none. Returns a plain reason or ''. */
export function boxProblem(raw: unknown): string {
  if (raw === undefined || raw === null) return '';
  if (!Array.isArray(raw) || raw.length !== 4 || !raw.every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 20000)) return 'The box is not right.';
  if (!(raw[2] > raw[0] && raw[3] > raw[1])) return 'The box is not right.';
  return '';
}
