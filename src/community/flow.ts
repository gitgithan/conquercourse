// The Community flow as plain logic (CC-247): the three steps, what each one needs before you may enter it, the tabs, the found things and the daily piece count.
// No page code here, so the rules are tested without a browser (tests/community-flow.test.ts).
import type { Suggestion } from '../slice/segment';

export type Step = 'photo' | 'segment' | 'make';
export const STEPS: { id: Step; label: string }[] = [
  { id: 'photo', label: 'Photo' }, { id: 'segment', label: 'Pick' }, { id: 'make', label: 'Make' },
];
export type Kind = 'piece';
export type Box = [number, number, number, number];

export interface FlowState {
  hasPhoto: boolean;
  segmented: boolean; // "Segment Region" has run and at least one found thing is picked
  choices: Record<number, Kind>; // by mark id; every pick is a piece now, filled in when it is picked
}
export const startState = (): FlowState => ({ hasPhoto: false, segmented: false, choices: {} });

/** The reason a step cannot be entered yet, in plain words, or '' when it can. */
export function whyNot(step: Step, s: FlowState): string {
  switch (step) {
    case 'photo': return '';
    case 'segment': return s.hasPhoto ? '' : 'Pick a photo first.';
    case 'make': return !s.hasPhoto ? 'Pick a photo first.' : !s.segmented ? 'Press Segment Region, then click the thing you want in the photo.' : '';
  }
}
export const canEnter = (step: Step, s: FlowState): boolean => whyNot(step, s) === '';
export const stepIndex = (step: Step): number => STEPS.findIndex((x) => x.id === step);
export const nextStep = (step: Step): Step | null => STEPS[stepIndex(step) + 1]?.id ?? null;
export const prevStep = (step: Step): Step | null => STEPS[stepIndex(step) - 1]?.id ?? null;

// ---- tabs ----
export type Tab = 'explore' | 'make';
export const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: 'explore', label: 'Explore', hint: 'Finished courses and pieces people made' },
  { id: 'make', label: 'Make your own', hint: 'Photo, Pick, Make' },
];
/** Which tab opens: Explore first, so a person sees finished work before the making flow. `?tab=make` (or the old `photos`) opens the flow; the old objects, places and gallery addresses open Explore. */
export function tabFor(mode: string | null, params: URLSearchParams): Tab {
  const t = params.get('tab');
  if (t === 'make' || t === 'photos') return 'make';
  if (t === 'explore' || t === 'objects' || t === 'places') return 'explore';
  return mode === 'gallery' ? 'explore' : 'explore';
}

// ---- the found things: a fixed order, and ticking several (CC-247) ----
/** The most things that can be ticked at once. */
export const MAX_PICKS = 4;
/** How many 3D pieces are made at the same time; the 3D maker handles one at a time, so the rest wait in line. */
export const LIFT_PARALLEL = 1;
/** A plain-words price for one piece (about 2 to 4 cents of GPU time): one lift makes one object, so N pieces cost N times. */
export const COST_WORDS = 'about 2 to 4 cents each';

const area = (b: Box): number => Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);
export interface Found { label: string; box: Box; cutout?: string; score?: number }

/**
 * One fixed order for the found things: biggest first, then top to bottom, left to right, then by name.
 * Nothing in it changes with the mouse, a click or the score, so the same photo always shows the same list.
 */
export function stableOrder<T extends Found>(items: T[]): T[] {
  return [...items].sort((a, b) => area(b.box) - area(a.box) || a.box[1] - b.box[1] || a.box[0] - b.box[0] || a.label.localeCompare(b.label));
}

/** The things to click after Segment Region: everything the finder saw, in the fixed order. Nothing is picked until the player clicks. */
export const buildFound = (found: Suggestion[]): Found[] => stableOrder(found.map((s) => ({ label: s.label, box: s.box, cutout: s.cutout || undefined, score: s.score })));

/** Tick or untick one item by its place in the list; a tick past the limit is ignored. Returns the new list of ticks, in list order. */
export function toggleTick(ticked: number[], index: number, max = MAX_PICKS): number[] {
  if (ticked.includes(index)) return ticked.filter((i) => i !== index);
  if (ticked.length >= max) return ticked;
  return [...ticked, index].sort((a, b) => a - b);
}

/** The words on the button that makes the ticked pieces. */
export const makeLabel = (n: number): string => (n === 1 ? 'Make 1 piece' : `Make ${n} pieces`);

// ---- the daily count of 3D pieces (CC-247): the page learns both numbers from the server (GET /api/object-lift); none is typed here ----
export interface PiecesToday { perDay: number; left: number }
const pieces = (n: number): string => (n === 1 ? '1 piece' : `${n} pieces`);
/** The line next to every make button, before it is pressed. */
export const dailyLine = (t: PiecesToday): string => `You can make ${pieces(t.perDay)} a day. ${t.left <= 0 ? 'None left today.' : `${t.left} left today.`} One lift makes one object, so more pieces cost more (${COST_WORDS}).`;
/** How many of the queued pieces may start now; with no count from the server, all of them (the server still decides). */
export const allowedNow = (queued: number, t: PiecesToday | null): number => (t ? Math.max(0, Math.min(queued, t.left)) : queued);
/** The warning when more pieces are queued than are left today, or ''. */
export function queueWarning(queued: number, t: PiecesToday | null): string {
  if (!t || queued <= t.left) return '';
  return t.left <= 0 ? `You have no pieces left today, so none of these ${queued} can be made. Come back tomorrow.` : `You queued ${queued} but only ${t.left} ${t.left === 1 ? 'is' : 'are'} left today. ${queued} pieces cost ${queued} times as much as one. The first ${t.left} can be made; the rest wait for tomorrow.`;
}
/** The plain reason a queued piece is switched off, or ''. `index` counts from 0 in queue order. */
export const whyOff = (index: number, t: PiecesToday | null): string => (t && index >= Math.max(0, t.left) ? 'Not today: there are no pieces left for this one. Try again tomorrow.' : '');

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
