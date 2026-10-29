// CC-200: choosing several pieces at once in the World editor. Pure logic, no page: the editor and the 3D view call it.
export interface Rect { x0: number; y0: number; x1: number; y1: number }
export interface Pickable { id: number; x: number; y: number; r?: number } // a centre and (optional) a half-size to count the edge

// a rectangle from two corners, in any order
export const rectFrom = (ax: number, ay: number, bx: number, by: number): Rect => ({ x0: Math.min(ax, bx), y0: Math.min(ay, by), x1: Math.max(ax, bx), y1: Math.max(ay, by) });

// a drag shorter than a few pixels is a click, not a marquee
export const isMarquee = (r: Rect, min = 4): boolean => r.x1 - r.x0 >= min || r.y1 - r.y0 >= min;

// the pieces whose centre, widened by their half-size, touches the rectangle
export function pickInRect(items: Pickable[], r: Rect): number[] {
  return items.filter((i) => i.x + (i.r ?? 0) >= r.x0 && i.x - (i.r ?? 0) <= r.x1 && i.y + (i.r ?? 0) >= r.y0 && i.y - (i.r ?? 0) <= r.y1).map((i) => i.id);
}

// Shift+click: add the piece, or take it out when it is already chosen
export const toggleId = (ids: number[], id: number): number[] => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]);

// a marquee adds to the choice when Shift is held, otherwise it replaces it; the order is kept and nothing repeats
export function applyMarquee(current: number[], picked: number[], additive: boolean): number[] {
  return additive ? [...current, ...picked.filter((i) => !current.includes(i))] : [...picked];
}

// the ids the editor treats as chosen: the group when the main choice is in it, otherwise just the main choice
export function chosenIds(group: Iterable<number>, main: number | null, exists: (id: number) => boolean): number[] {
  const g = [...group].filter(exists);
  if (g.length > 1 && main !== null && g.includes(main)) return g;
  return main !== null && exists(main) ? [main] : [];
}

export const countText = (n: number): string => (n === 1 ? '1 selected' : `${n} selected`);

// remove the chosen pieces from a list in one go (the editor records one undo step after it)
export function withoutIds<T extends { id: number }>(list: T[], ids: number[]): T[] {
  const gone = new Set(ids);
  return list.filter((p) => !gone.has(p.id));
}
