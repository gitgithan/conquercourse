// The Community flow as plain logic (CC-247): the five steps, what each one needs before you may enter it, the three tabs, and how a marked area finds its cut-out.
// No page code here, so the rules are tested without a browser (tests/community-flow.test.ts).
import type { Suggestion } from '../slice/segment';

export type Step = 'photo' | 'mark' | 'segment' | 'choose' | 'make';
export const STEPS: { id: Step; label: string }[] = [
  { id: 'photo', label: 'Photo' }, { id: 'mark', label: 'Mark' }, { id: 'segment', label: 'Segment' }, { id: 'choose', label: 'Choose' }, { id: 'make', label: 'Make' },
];
export type Kind = 'piece' | 'wallpaper';
export type Box = [number, number, number, number];

export interface FlowState {
  hasPhoto: boolean;
  marks: number; // areas the person marked (or picked from the suggestions)
  segmented: boolean; // "Segment Region(s)" has run (or was skipped because the job is off)
  choices: Record<number, Kind>; // by mark id
}
export const startState = (): FlowState => ({ hasPhoto: false, marks: 0, segmented: false, choices: {} });

/** The reason a step cannot be entered yet, in plain words, or '' when it can. */
export function whyNot(step: Step, s: FlowState): string {
  switch (step) {
    case 'photo': return '';
    case 'mark': return s.hasPhoto ? '' : 'Pick a photo first.';
    case 'segment': return !s.hasPhoto ? 'Pick a photo first.' : s.marks === 0 ? 'Mark at least one area on the photo.' : '';
    case 'choose': return !s.hasPhoto ? 'Pick a photo first.' : s.marks === 0 ? 'Mark at least one area on the photo.' : !s.segmented ? 'Press Segment Region(s) first.' : '';
    case 'make': return whyNot('choose', s) || (Object.keys(s.choices).length === 0 ? 'Choose 3D piece or Wallpaper for at least one area.' : '');
  }
}
export const canEnter = (step: Step, s: FlowState): boolean => whyNot(step, s) === '';
export const stepIndex = (step: Step): number => STEPS.findIndex((x) => x.id === step);
export const nextStep = (step: Step): Step | null => STEPS[stepIndex(step) + 1]?.id ?? null;
export const prevStep = (step: Step): Step | null => STEPS[stepIndex(step) - 1]?.id ?? null;

/** Going back never loses work, but changing the marks means the cut-outs are stale: the segment step must run again. */
export function afterMarksChanged(s: FlowState, marks: number): FlowState {
  const choices: Record<number, Kind> = {};
  return { ...s, marks, segmented: false, choices };
}

// ---- tabs ----
export type Tab = 'explore' | 'make';
export const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: 'explore', label: 'Explore', hint: 'Finished courses, pieces and wallpapers people made' },
  { id: 'make', label: 'Make your own', hint: 'Photo, Mark, Segment, Choose, Make' },
];
/** Which tab opens: Explore first, so a person sees finished work before the making flow. `?tab=make` (or the old `photos`) opens the flow; the old objects, places and gallery addresses open Explore. */
export function tabFor(mode: string | null, params: URLSearchParams): Tab {
  const t = params.get('tab');
  if (t === 'make' || t === 'photos') return 'make';
  if (t === 'explore' || t === 'objects' || t === 'places') return 'explore';
  return mode === 'gallery' ? 'explore' : 'explore';
}

/** On by `?flow=1`, off by `?flow=0`; with neither, on only on the preview address (the old screens stay until the owner says so). */
export function flowOn(params: URLSearchParams, host = typeof location === 'undefined' ? '' : location.hostname): boolean {
  const f = params.get('flow');
  if (f === '1') return true;
  if (f === '0') return false;
  return host === 'preview.conquercourse.pages.dev';
}

// ---- marks and cut-outs ----
const area = (b: Box): number => Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);
export function iou(a: Box, b: Box): number {
  const w = Math.min(a[2], b[2]) - Math.max(a[0], b[0]), h = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
  if (w <= 0 || h <= 0) return 0;
  const i = w * h;
  return i / (area(a) + area(b) - i);
}
const centreIn = (inner: Box, outer: Box): boolean => { const cx = (inner[0] + inner[2]) / 2, cy = (inner[1] + inner[3]) / 2; return cx >= outer[0] && cx <= outer[2] && cy >= outer[1] && cy <= outer[3]; };

/**
 * The server finds things on its own; it does not take a mark as a hint. So each marked area takes the suggestion that overlaps it most
 * (or whose centre sits inside it), and a suggestion nobody took is offered as an extra outline to click.
 */
export function matchSuggestions(marks: { id: number; box: Box }[], found: Suggestion[]): { matched: Map<number, Suggestion>; extras: Suggestion[] } {
  const matched = new Map<number, Suggestion>(), used = new Set<Suggestion>();
  const pairs: { id: number; s: Suggestion; score: number }[] = [];
  for (const m of marks) for (const s of found) {
    const o = iou(m.box, s.box), inside = centreIn(s.box, m.box) || centreIn(m.box, s.box);
    if (o >= 0.2 || inside) pairs.push({ id: m.id, s, score: o + (inside ? 0.05 : 0) });
  }
  pairs.sort((a, b) => b.score - a.score);
  for (const p of pairs) { if (matched.has(p.id) || used.has(p.s)) continue; matched.set(p.id, p.s); used.add(p.s); }
  return { matched, extras: found.filter((s) => !used.has(s)) };
}

/** The crop for a wallpaper: the marked box, widened a little to the course's 16:9 look and kept inside the photo. */
export function wallpaperCrop(box: Box, width: number, height: number): Box {
  let [x0, y0, x1, y1] = box;
  const w = x1 - x0, h = y1 - y0, want = 16 / 9;
  if (w / h < want) { const nw = h * want, d = (nw - w) / 2; x0 -= d; x1 += d; } else { const nh = w / want, d = (nh - h) / 2; y0 -= d; y1 += d; }
  const cw = Math.min(x1 - x0, width), ch = Math.min(y1 - y0, height);
  const cx = Math.min(Math.max(x0, 0), width - cw), cy = Math.min(Math.max(y0, 0), height - ch);
  return [Math.round(cx), Math.round(cy), Math.round(cx + cw), Math.round(cy + ch)];
}
