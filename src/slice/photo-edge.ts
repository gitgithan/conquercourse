// CC-170: a photo whose object touches the photo edge is never rejected for that alone: pad the photo (about 1.5 times as large) and try again.
// Browser side: the box the player draws, the pad geometry (same numbers as pipelines/ccpipe/padretry.py) and the words shown.
export const PAD = 0.25;      // padding per side as a share of the photo size: 1 + 2 * 0.25 = a canvas 1.5 times as large
export const TOUCH_PX = 2;    // a box within this many pixels of the photo edge touches it

export const NOTE_PAD = 'Your object runs off the edge of the photo. We add space around the photo and try once more.';
export const NOTE_STILL = 'It still looks cut off. Try a photo where the whole object is inside the picture, or draw the box yourself.';

export type Box = [number, number, number, number];
export interface Sides { top: boolean; bottom: boolean; left: boolean; right: boolean }

/** Which photo edges a box (x0 y0 x1 y1) reaches. */
export function boxEdgeContact(box: Box, w: number, h: number, tol = TOUCH_PX): Sides {
  return { left: box[0] <= tol, top: box[1] <= tol, right: box[2] >= w - tol, bottom: box[3] >= h - tol };
}
export const touchesEdge = (s: Sides): boolean => s.top || s.bottom || s.left || s.right;

/** The larger canvas and where the photo sits on it; the box moves by the same offset, so object pixels do not move. */
export function padGeometry(w: number, h: number, frac = PAD): { w: number; h: number; dx: number; dy: number } {
  const dx = Math.round(w * frac), dy = Math.round(h * frac);
  return { w: w + 2 * dx, h: h + 2 * dy, dx, dy };
}
export const padBox = (box: Box, w: number, h: number, frac = PAD): Box => {
  const g = padGeometry(w, h, frac);
  return [box[0] + g.dx, box[1] + g.dy, box[2] + g.dx, box[3] + g.dy];
};

/** `?padretry=0` turns it off; anything else (or nothing) leaves it on. */
export const padRetryOn = (search: string): boolean => new URLSearchParams(search).get('padretry') !== '0';

/** The short plain words for the player; '' when nothing is to be said. */
export function edgeNote(boxes: Box[], w: number, h: number, search = ''): string {
  if (!padRetryOn(search)) return '';
  return boxes.some((b) => touchesEdge(boxEdgeContact(b, w, h))) ? NOTE_PAD : '';
}
