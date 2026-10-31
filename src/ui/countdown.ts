import { countdownLabel } from '../sim/slow-down';

/** A button that waits out a server pause (CC-219): it is off, its label counts down, and when time is up it comes back by itself with its old label. */
export function countdownButton(btn: HTMLButtonElement, seconds: number, restore: string, label: (left: number) => string = (s) => `Try again in ${countdownLabel(s)}`, onDone?: () => void): void {
  const end = Date.now() + seconds * 1000;
  btn.disabled = true;
  const tick = (): void => {
    const left = Math.ceil((end - Date.now()) / 1000);
    if (left <= 0 || !btn.isConnected) { btn.textContent = restore; btn.disabled = false; onDone?.(); return; }
    btn.textContent = label(left);
    setTimeout(tick, 1000);
  };
  tick();
}
