// Click outside a dialog to close it (CC-243). A close only counts when the press AND the release both land on the backdrop,
// so dragging from inside the panel to outside (for example while selecting text) never closes it.

export interface BackdropEvent { target: unknown }

/** Returns the two handlers: wire `down` to pointerdown and `click` to click on the backdrop element. */
export function backdropGuard(backdrop: unknown, close: () => void): { down: (e: BackdropEvent) => void; click: (e: BackdropEvent) => void } {
  let pressedOnBackdrop = false;
  return {
    down: (e) => { pressedOnBackdrop = e.target === backdrop; },
    click: (e) => { const ok = pressedOnBackdrop && e.target === backdrop; pressedOnBackdrop = false; if (ok) close(); },
  };
}

/** Wire a backdrop element so a click on the bare backdrop calls `close` (the same function Esc uses). */
export function closeOnBackdrop(backdrop: HTMLElement, close: () => void): void {
  const g = backdropGuard(backdrop, close);
  backdrop.addEventListener('pointerdown', g.down);
  backdrop.addEventListener('click', g.click);
}
