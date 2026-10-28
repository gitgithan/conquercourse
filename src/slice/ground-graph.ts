import type { CourseData } from '../course/course';
import type { Platform } from '../sim/terrain';

// Graph Studio, part 1 (CC-86): the maths of "pause and drag the ground". A course's side view is a graph: decks with a height and two
// edges, and bars hanging in the air. Each part gets handles; dragging a handle returns a new course (nothing is changed in place), clamped
// so a drag can never make a course the simulator cannot even read (decks overlapping, a deck thinner than a person, the finish off the ground).
// Pure: no drawing here.
export type HandleKind = 'top' | 'edge-left' | 'edge-right' | 'bar';
export interface Handle { id: string; kind: HandleKind; index: number; x: number; y: number }

export const SNAP_Y = 0.1; // m, heights snap to a tenth of a metre
export const SNAP_X = 0.25; // m, edges and bars snap to a quarter of a metre
export const MIN_WIDTH = 0.8; // m, thinnest deck
export const MIN_TOP = -10;
export const MAX_TOP = 30;
export const MIN_BAR_GAP = 1; // m, two bars never share a place
export const MIN_BAR_Y = 1; // m, lowest a bar hangs
export const MAX_BAR_Y = 16;
const MAX_EDGE_SLIDE = 60; // m, the outer edges of the course may stretch this far

const snap = (v: number, s: number) => Math.round(v / s) * s;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r2 = (v: number) => +v.toFixed(2);

// Decks the studio will not touch: the ones a machine or a wall stands on or hangs from (their shapes are part of that move) and curved or bouncy tops.
export function lockedPlatforms(course: CourseData): Set<number> {
  const out = new Set<number>();
  course.terrain.platforms.forEach((p, i) => {
    if (p.profile || p.bouncy) out.add(i);
    const w = course.wall;
    if (w) { const R = w.radius ?? w.height ?? 4.3; if (p.x1 > w.x0 - 0.01 && p.x0 < w.x0 + R + 0.5 + (w.height ?? 4.3)) out.add(i); }
    const t = course.trebuchet;
    if (t && p.x0 - 0.01 <= t.x && t.x <= p.x1 + 0.01) out.add(i);
    const rc = course.recoil;
    if (rc && p.x1 > rc.x0 && p.x0 < rc.x1) out.add(i);
    if (course.rope && p.x0 <= course.rope.anchorX + 0.01 && course.rope.anchorX <= p.x1 + 0.01) out.add(i);
  });
  return out;
}

// A course the studio can edit at all: a coaster's track is edited in its own builder.
export const editable = (course: CourseData): boolean => !course.track && course.terrain.platforms.length > 0;

export function handlesOf(course: CourseData): Handle[] {
  const out: Handle[] = [];
  const locked = lockedPlatforms(course);
  course.terrain.platforms.forEach((p, i) => {
    if (locked.has(i)) return;
    out.push({ id: `top:${i}`, kind: 'top', index: i, x: r2((p.x0 + p.x1) / 2), y: p.top });
    out.push({ id: `edge-left:${i}`, kind: 'edge-left', index: i, x: p.x0, y: p.top });
    out.push({ id: `edge-right:${i}`, kind: 'edge-right', index: i, x: p.x1, y: p.top });
  });
  (course.holds ?? []).forEach((h, i) => out.push({ id: `bar:${i}`, kind: 'bar', index: i, x: h.x, y: h.y }));
  return out;
}

export interface DragResult { course: CourseData; note?: string }

// Move a handle to (x, y) in metres (the pointer's place on the side view). Returns the new course; the old one is untouched.
export function dragHandle(course: CourseData, h: Handle, x: number, y: number): DragResult {
  const ps: Platform[] = course.terrain.platforms.map((p) => ({ ...p }));
  const sorted = ps.map((p, i) => ({ p, i })).sort((a, b) => a.p.x0 - b.p.x0);
  const rank = sorted.findIndex((s) => s.i === h.index);
  const holds = course.holds?.map((q) => ({ ...q }));
  const finishX = course.finishX, startX = course.startX;

  if (h.kind === 'top') {
    ps[h.index].top = r2(clamp(snap(y, SNAP_Y), MIN_TOP, MAX_TOP));
  } else if (h.kind === 'edge-left' || h.kind === 'edge-right') {
    const p = ps[h.index];
    const prev = rank > 0 ? sorted[rank - 1].p : null, next = rank < sorted.length - 1 ? sorted[rank + 1].p : null;
    if (h.kind === 'edge-left') {
      const lo = prev ? prev.x1 : p.x0 - MAX_EDGE_SLIDE;
      let hi = p.x1 - MIN_WIDTH;
      if (startX >= p.x0 && startX <= p.x1) hi = Math.min(hi, startX - 0.5); // the runner starts on this deck: its left edge stays behind the start
      p.x0 = r2(clamp(snap(x, SNAP_X), lo, Math.max(lo, hi)));
    } else {
      let lo = p.x0 + MIN_WIDTH;
      if (finishX >= p.x0 && finishX <= p.x1) lo = Math.max(lo, finishX + 0.5); // the finish is on this deck: its right edge stays past the finish
      const hi = next ? next.x0 : p.x1 + MAX_EDGE_SLIDE;
      p.x1 = r2(clamp(snap(x, SNAP_X), Math.min(lo, hi), hi));
    }
  } else if (holds) {
    const q = holds[h.index];
    const lo = h.index > 0 ? holds[h.index - 1].x + MIN_BAR_GAP : startX, hi = h.index < holds.length - 1 ? holds[h.index + 1].x - MIN_BAR_GAP : finishX + 20;
    q.x = r2(clamp(snap(x, SNAP_X), lo, Math.max(lo, hi)));
    q.y = r2(clamp(snap(y, SNAP_Y), MIN_BAR_Y, MAX_BAR_Y));
  }

  return finishEdit(course, ps, holds);
}

// What an edit makes stale: a stored proof (it was for the old ground), and the real objects drawn on the old ground (they would float or sink).
function finishEdit(course: CourseData, ps: Platform[], holds: CourseData['holds']): DragResult {
  const { plan: _plan, routes: _routes, scene, uMap, ...rest } = course;
  void _plan; void _routes;
  const next: CourseData = { ...rest, terrain: { ...course.terrain, platforms: ps }, ...(holds ? { holds } : {}) };
  const dropped = !!(scene?.length || uMap?.length);
  return { course: next, ...(dropped ? { note: 'The real objects drawn on this ground are shown as plain blocks after an edit.' } : {}) };
}

// Double-click on a deck: cut a gap into it at x (the way a double-click adds a dot in the coaster builder). Null when it cannot be done.
export function splitDeck(course: CourseData, index: number, x: number, gap = 2): DragResult | null {
  const p = course.terrain.platforms[index];
  if (!p || lockedPlatforms(course).has(index)) return null;
  const at = snap(x, SNAP_X), end = at + gap;
  if (at - p.x0 < MIN_WIDTH || p.x1 - end < MIN_WIDTH) return null;
  for (const v of [course.startX, course.finishX]) if (v >= at - 0.5 && v <= end + 0.5) return null; // never cut the ground out from under the start or the finish
  const ps = course.terrain.platforms.map((q) => ({ ...q }));
  ps.splice(index, 1, { ...p, x1: r2(at) }, { ...p, x0: r2(end) });
  return finishEdit(course, ps, course.holds?.map((q) => ({ ...q })));
}

// Double-click on a deck's edge: close the gap on that side (the edge goes out to the neighbour). Null when there is no gap.
export function closeGap(course: CourseData, h: Handle): DragResult | null {
  if (h.kind !== 'edge-left' && h.kind !== 'edge-right') return null;
  const ps = course.terrain.platforms.map((q) => ({ ...q }));
  const order = ps.map((p, i) => ({ p, i })).sort((a, b) => a.p.x0 - b.p.x0), rank = order.findIndex((o) => o.i === h.index);
  const me = ps[h.index], other = h.kind === 'edge-right' ? order[rank + 1]?.p : order[rank - 1]?.p;
  if (!other) return null;
  if (h.kind === 'edge-right') { if (other.x0 - me.x1 < 0.05) return null; me.x1 = other.x0; } else { if (me.x0 - other.x1 < 0.05) return null; me.x0 = other.x1; }
  return finishEdit(course, ps, course.holds?.map((q) => ({ ...q })));
}

// Plain words for what differs between two courses: one sentence per deck, gap or bar that moved.
export function changeWords(a: CourseData, b: CourseData): string[] {
  const out: string[] = [];
  const m = (v: number) => `${+Math.abs(v).toFixed(2)} m`;
  const pa = [...a.terrain.platforms].sort((p, q) => p.x0 - q.x0), pb = [...b.terrain.platforms].sort((p, q) => p.x0 - q.x0);
  pb.forEach((p, i) => {
    const o = pa[i];
    if (!o) return;
    const dy = p.top - o.top;
    if (Math.abs(dy) >= 0.01) out.push(`Deck ${i + 1}: ${dy > 0 ? 'raise' : 'lower'} it ${m(dy)} (now ${p.top.toFixed(1)} m high).`);
    const ga = pa[i + 1] ? pa[i + 1].x0 - o.x1 : null, gb = pb[i + 1] ? pb[i + 1].x0 - p.x1 : null;
    if (ga !== null && gb !== null && Math.abs(gb - ga) >= 0.01) out.push(`Gap ${i + 1}: ${gb > ga ? 'wider' : 'narrower'}, ${ga.toFixed(1)} m to ${gb.toFixed(1)} m.`);
    if (i === 0 && Math.abs(p.x0 - o.x0) >= 0.01) out.push(`The first deck starts ${m(p.x0 - o.x0)} ${p.x0 < o.x0 ? 'earlier' : 'later'}.`);
    if (i === pb.length - 1 && Math.abs(p.x1 - o.x1) >= 0.01) out.push(`The last deck ends ${m(p.x1 - o.x1)} ${p.x1 > o.x1 ? 'later' : 'earlier'}.`);
  });
  (b.holds ?? []).forEach((h, i) => {
    const o = a.holds?.[i];
    if (!o) return;
    const dx = h.x - o.x, dy = h.y - o.y;
    if (Math.abs(dx) >= 0.01 || Math.abs(dy) >= 0.01) {
      const parts: string[] = [];
      if (Math.abs(dx) >= 0.01) parts.push(`${m(dx)} ${dx > 0 ? 'further along' : 'closer to the start'}`);
      if (Math.abs(dy) >= 0.01) parts.push(`${m(dy)} ${dy > 0 ? 'higher' : 'lower'}`);
      out.push(`Bar ${i + 1}: ${parts.join(' and ')}.`);
    }
  });
  return out;
}
