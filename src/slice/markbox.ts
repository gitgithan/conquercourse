// "Mark it yourself" (CC-133, owner decision 2026-11-03): a player drags a rectangle on the photo when the finder missed the thing.
// Pure box rules, no page code, so they are tested without a browser (tests/markbox.test.ts).
// The box then goes down the same path as a picked outline; the safety check and the privacy blur still run on the whole photo first.
import { MIN_BOX } from './object-lift';

export type Box = [number, number, number, number];
export interface Pt { x: number; y: number }
export interface Rect { left: number; top: number; width: number; height: number }

/** Smallest side of a marked box, in photo pixels: the server limit, or 3 percent of the shorter side when that is larger. */
export const minSide = (w: number, h: number): number => Math.max(MIN_BOX, Math.round(0.03 * Math.min(w, h)));
/** A marked box may cover at most this share of the photo; a box round everything is not a thing. */
export const MAX_SHARE = 0.8;
/** A person box may be covered by a marked box up to this share before the mark is refused. */
export const PERSON_COVER = 0.25;
/** A marked box that is mostly person (this share of the box is inside a person box) is refused. */
export const PERSON_INSIDE = 0.5;
export const MARK_LABELS = ['bar', 'bench', 'pole', 'other'] as const;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const area = (b: Box): number => Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);
const overlap = (a: Box, b: Box): number => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));

/** Photo pixel under a screen point; the picture is shown scaled into `rect`. The point is held inside the photo. */
export function screenToPhoto(p: Pt, rect: Rect, w: number, h: number): Pt {
  return { x: clamp(((p.x - rect.left) / rect.width) * w, 0, w), y: clamp(((p.y - rect.top) / rect.height) * h, 0, h) };
}
/** The reverse: a photo box as a screen box inside `rect`. */
export const photoToScreen = (b: Box, rect: Rect, w: number, h: number): Rect => ({ left: (b[0] / w) * rect.width, top: (b[1] / h) * rect.height, width: ((b[2] - b[0]) / w) * rect.width, height: ((b[3] - b[1]) / h) * rect.height });

/** Two corners in any order to a whole-number box held inside the photo. */
export function boxFromCorners(a: Pt, b: Pt, w: number, h: number): Box {
  return [clamp(Math.round(Math.min(a.x, b.x)), 0, w), clamp(Math.round(Math.min(a.y, b.y)), 0, h), clamp(Math.round(Math.max(a.x, b.x)), 0, w), clamp(Math.round(Math.max(a.y, b.y)), 0, h)];
}
/** Pulls a box back inside the photo without changing its size where it can (a box bigger than the photo is cut to it). */
export function clampBox(b: Box, w: number, h: number): Box {
  const bw = Math.min(b[2] - b[0], w), bh = Math.min(b[3] - b[1], h);
  const x0 = clamp(b[0], 0, w - bw), y0 = clamp(b[1], 0, h - bh);
  return [Math.round(x0), Math.round(y0), Math.round(x0 + bw), Math.round(y0 + bh)];
}
/** A start box for the keyboard: a third of the photo, in the middle. */
export const startBox = (w: number, h: number): Box => clampBox([w / 3, h / 3, (2 * w) / 3, (2 * h) / 3], w, h);

/** Arrow keys move the box; with `resize` they move its right and bottom edge instead. Step is 2 percent of the shorter side. Never smaller than the minimum. */
export function nudge(b: Box, key: string, resize: boolean, w: number, h: number): Box {
  const step = Math.max(2, Math.round(0.02 * Math.min(w, h)));
  const dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0, dy = key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0;
  if (!resize) return clampBox([b[0] + dx, b[1] + dy, b[2] + dx, b[3] + dy], w, h);
  const m = minSide(w, h);
  return [b[0], b[1], clamp(b[2] + dx, b[0] + m, w), clamp(b[3] + dy, b[1] + m, h)];
}

/** A short plain reason the box cannot be used, or '' when its size is fine. */
export function sizeProblem(b: Box, w: number, h: number): string {
  const m = minSide(w, h);
  if (b[2] - b[0] < m || b[3] - b[1] < m) return 'That box is too small. Drag a bigger one round the whole thing.';
  if (area(b) > MAX_SHARE * w * h) return 'That box covers almost the whole photo. Drag it round just the one thing.';
  return '';
}

/** True when the box covers a person or a face the privacy step found: mostly person inside the box, or a big part of one person covered. */
export function coversPerson(b: Box, people: Box[]): boolean {
  const a = area(b);
  return people.some((p) => { const o = overlap(b, p), pa = area(p); return o > 0 && ((pa > 0 && o / pa >= PERSON_COVER) || (a > 0 && o / a >= PERSON_INSIDE)); });
}

/** Everything checked before a marked box is used: size, then people, then the label. Returns the plain reason, or '' when the box can be used. */
export function markProblem(b: Box, w: number, h: number, people: Box[], label: string): string {
  return sizeProblem(b, w, h)
    || (coversPerson(b, people) ? 'There is a person in that box, and people are never used. Drag the box round just the thing, away from the person.' : '')
    || (/^[a-z][a-z \-]{1,29}$/.test(label.trim().toLowerCase()) ? '' : 'Say what it is in a few letters, for example: bar.');
}

/** Person and face boxes from the finder's reply, held inside the photo; anything odd is dropped. */
export function cleanPeople(raw: unknown, w: number, h: number): Box[] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).filter((r): r is number[] => Array.isArray(r) && r.length === 4 && r.every((v) => typeof v === 'number' && Number.isFinite(v)))
    .map((r) => clampBox(r as Box, w, h)).filter((r) => r[2] > r[0] && r[3] > r[1]).slice(0, 60);
}

/** The feature switch: on unless the address has ?markbox=0. */
export const markOn = (params: URLSearchParams): boolean => params.get('markbox') !== '0';
