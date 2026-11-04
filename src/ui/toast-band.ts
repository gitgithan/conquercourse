// CC-133: the one place short messages (the hint, the toasts and the dimmed older hints) are drawn.
// They used to sit in the middle of the picture, over the runner. The runner is always in the lower middle of the view
// (the side camera looks 2.5 m above the feet), so the messages live in a band in the sky at the top-centre instead.
// One variable sets the band's top edge for all of them; nothing places a toast by itself.
export const TOAST_TOP_VAR = '--cc-toast-top';
export const TOAST_TOP = '232px'; // under the obstacle strip (92 to 165 px with the next icon grown) and the ghost chip with its gap line (172 to 225 px), clear of the time line (left) and the buttons (right)
export const TOAST_BAND_ID = 'toast-band';
export const TOAST_BAND_WIDTH = 600; // px, the widest a message gets
export const TOAST_BAND_BOTTOM = 0.5; // share of the window height: the two dimmed rows (55 px) and a two-line message fit above this line, which the runner never reaches (head at about 0.54, about 0.46 when the camera trails)

/** The band's box in a window of vw x vh pixels (pure, so a test can put it next to the runner's box). */
export function toastBandBox(vw: number, vh: number): { left: number; top: number; right: number; bottom: number } {
  const w = Math.min(TOAST_BAND_WIDTH, vw * 0.92), top = parseFloat(TOAST_TOP);
  return { left: (vw - w) / 2, right: (vw + w) / 2, top, bottom: Math.max(top, vh * TOAST_BAND_BOTTOM) };
}

/** The band element: made once, then shared. Messages are appended into it and flow downward in the order they were appended. */
export function toastBand(parent: HTMLElement = document.body): HTMLElement {
  const old = document.getElementById(TOAST_BAND_ID);
  if (old) return old;
  document.documentElement.style.setProperty(TOAST_TOP_VAR, TOAST_TOP);
  const el = document.createElement('div');
  el.id = TOAST_BAND_ID;
  el.style.cssText = `position:fixed;left:50%;top:var(${TOAST_TOP_VAR});transform:translateX(-50%);width:min(${TOAST_BAND_WIDTH}px,92vw);display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none;z-index:30`;
  parent.append(el);
  return el;
}
