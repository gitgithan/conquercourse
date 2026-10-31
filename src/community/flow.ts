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
  marks: number; // 0 or 1: the one rectangle the person marked
  segmented: boolean; // "Segment Region" has run (or was skipped because the job is off)
  choices: Record<number, Kind>; // by mark id
}
export const startState = (): FlowState => ({ hasPhoto: false, marks: 0, segmented: false, choices: {} });

/** The reason a step cannot be entered yet, in plain words, or '' when it can. */
export function whyNot(step: Step, s: FlowState): string {
  switch (step) {
    case 'photo': return '';
    case 'mark': return s.hasPhoto ? '' : 'Pick a photo first.';
    case 'segment': return !s.hasPhoto ? 'Pick a photo first.' : s.marks === 0 ? 'Mark the area you want on the photo.' : '';
    case 'choose': return !s.hasPhoto ? 'Pick a photo first.' : s.marks === 0 ? 'Mark the area you want on the photo.' : !s.segmented ? 'Press Segment Region first.' : '';
    case 'make': return whyNot('choose', s) || (Object.keys(s.choices).length === 0 ? 'Choose 3D piece or Wallpaper for your area.' : '');
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

// ---- the found things: a fixed order, and ticking several (CC-247) ----
/** The most things that can be ticked at once. */
export const MAX_PICKS = 4;
/** How many 3D pieces are made at the same time; the 3D maker handles one at a time, so the rest wait in line. */
export const LIFT_PARALLEL = 1;
/** A plain-words price for one extra piece (about 2 to 4 cents of GPU time), so nobody is surprised. */
export const COST_WORDS = 'about 2 to 4 cents each';

export interface Found { label: string; box: Box; cutout?: string; score?: number; yours?: boolean }

/**
 * One fixed order for the found things: yours first, then biggest first, then top to bottom, left to right, then by name.
 * Nothing in it changes with the mouse, a click or the score, so the same photo always shows the same list.
 */
export function stableOrder<T extends Found>(items: T[]): T[] {
  return [...items].sort((a, b) => Number(!!b.yours) - Number(!!a.yours) || area(b.box) - area(a.box) || a.box[1] - b.box[1] || a.box[0] - b.box[0] || a.label.localeCompare(b.label));
}

/** The things to choose from after Segment Region: the marked box first (named by the finder when it matched), then everything else the finder saw. */
export function buildFound(mark: { box: Box; label?: string; cutout?: string } | null, found: Suggestion[]): { items: Found[]; ticked: number[] } {
  const items: Found[] = [];
  let rest = found;
  if (mark) {
    const { matched, extras } = matchSuggestions([{ id: 0, box: mark.box }], found);
    const m = matched.get(0);
    items.push({ label: m?.label ?? (mark.label || 'your box'), box: mark.box, cutout: m?.cutout || mark.cutout || undefined, score: m?.score, yours: true });
    rest = extras;
  }
  items.push(...rest.map((s) => ({ label: s.label, box: s.box, cutout: s.cutout || undefined, score: s.score })));
  return { items: stableOrder(items), ticked: mark ? [0] : [] };
}

/** Tick or untick one item by its place in the list; a tick past the limit is ignored. Returns the new list of ticks, in list order. */
export function toggleTick(ticked: number[], index: number, max = MAX_PICKS): number[] {
  if (ticked.includes(index)) return ticked.filter((i) => i !== index);
  if (ticked.length >= max) return ticked;
  return [...ticked, index].sort((a, b) => a - b);
}

/** The words on the button that makes the ticked pieces. */
export const makeLabel = (n: number): string => (n === 1 ? 'Make 1 piece' : `Make ${n} pieces`);

/** Runs `work` for each item, at most `parallel` at once; the rest wait in line. Every item reports its own result or failure. */
export async function runQueue<T, R>(items: T[], work: (item: T, index: number) => Promise<R>, parallel = LIFT_PARALLEL, onState?: (index: number, state: 'waiting' | 'running' | 'done' | 'failed') => void): Promise<PromiseSettledResult<R>[]> {
  const out: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  items.forEach((_, i) => onState?.(i, 'waiting'));
  const lane = async () => {
    while (next < items.length) {
      const i = next++;
      onState?.(i, 'running');
      try { out[i] = { status: 'fulfilled', value: await work(items[i], i) }; onState?.(i, 'done'); } catch (reason) { out[i] = { status: 'rejected', reason }; onState?.(i, 'failed'); }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(parallel, items.length)) }, lane));
  return out;
}

// ---- the prize turntable (CC-247) ----
/** One full turn takes this long. */
export const PRIZE_TURN_MS = 8000;
/** The turntable angle in radians after `elapsedMs`: a full 360 degree turn every PRIZE_TURN_MS; for reduced motion a fixed three-quarter view that never moves. */
export const turnAngle = (elapsedMs: number, reduced = false): number => (reduced ? Math.PI / 4 : ((elapsedMs % PRIZE_TURN_MS) / PRIZE_TURN_MS) * Math.PI * 2);

/** The address that opens the World Editor with one of your pieces ready to place. */
export const editorHref = (pieceId: string): string => `?mode=editor&welcome=0&uploadobj=1&place=${encodeURIComponent(pieceId)}`;
/** The piece id from `?place=`, or '' when absent or odd-looking. */
export const placeParam = (search: string): string => { const v = new URLSearchParams(search).get('place') ?? ''; return /^(shared:)?[A-Za-z0-9_-]{1,80}$/.test(v) ? v : ''; };

// Other players' shared pieces (CC-247): usable like your own once added to your list
export const sharedSrc = (id: string): string => `shared:${id}`;
export const isSharedSrc = (src: string | undefined): boolean => !!src && /^shared:[A-Za-z0-9_-]{1,80}$/.test(src);
export const sharedGlbUrl = (id: string): string => `/api/community-items?id=${encodeURIComponent(id)}&file=glb`;
/** A piece from the gallery can be placed only when it is a piece and the safety check has passed it (held, blocked and removed ones never). */
export const placeableShared = (it: { kind?: string; status?: string }): boolean => it.kind === 'piece' && (it.status === undefined || it.status === 'approved');
const SHARED_KEY = 'cc.shared-pieces';
export interface SharedPick { id: string; name: string }
export function usedShared(): SharedPick[] {
  try { const v = JSON.parse(localStorage.getItem(SHARED_KEY) ?? '[]') as unknown; return Array.isArray(v) ? v.filter((x): x is SharedPick => !!x && typeof (x as SharedPick).id === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test((x as SharedPick).id) && typeof (x as SharedPick).name === 'string').map((x) => ({ id: x.id, name: x.name.slice(0, 40) })) : []; } catch { return []; }
}
export function useShared(pick: SharedPick): void {
  try { const all = usedShared().filter((x) => x.id !== pick.id); all.push({ id: pick.id, name: pick.name.slice(0, 40) }); localStorage.setItem(SHARED_KEY, JSON.stringify(all.slice(-30))); } catch { /* not remembered */ }
}
/** How many cards a group in Add pieces shows before Show more. */
export const GROUP_SHOWN = 12;
