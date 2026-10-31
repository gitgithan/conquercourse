// CC-118: every Lab opens already run at our own setting (owner, 2026-11-01), so a demo shows the best result with no click on Run.
// This label says so in plain words, and says whether the numbers were computed just now in the page or precomputed offline with the same code.
export const SHOWING_OUR_SETTING = 'Showing our setting, already run';

export function labDefaultNote(host: HTMLElement, how: 'live' | { precomputed: true; seed: number | string }, anchor?: HTMLElement | null): HTMLElement {
  host.querySelector('#lab-default-note')?.remove();
  const p = document.createElement('p');
  p.id = 'lab-default-note';
  p.style.cssText = 'margin:4px 0 0;font:600 13px system-ui,sans-serif;color:#0f6b5c';
  p.textContent = how === 'live' ? `${SHOWING_OUR_SETTING}. Change a control and press Run to try your own.` : `${SHOWING_OUR_SETTING}. Precomputed with the same code (seed ${how.seed}). Change a control and press Run to try your own.`;
  if (anchor) anchor.after(p); else host.prepend(p);
  return p;
}

/** Marks the page for the smoke test: set once every output of the opening state is on the screen. */
export function labPopulated(mode: string): void {
  document.documentElement.dataset.labPopulated = mode;
  document.documentElement.dataset.labPopulatedAt = String(Math.round(performance.now()));
}
