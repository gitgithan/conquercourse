// The hint history: the current hint stays where it is; the hints before it sit just under it in the sky band (CC-133), dimmer the older they are, then fade away.
// It only reads the hint text; it never changes the hint.
import { toastBand } from './toast-band';

export interface HintHistory { update(current: string, hintEl: HTMLElement, nowMs: number): void }
const KEEP = 1, LIFE_MS = 9000, DIM = [0.6]; // one older line, one row tall: the band must stay above the runner's head

export function createHintHistory(parent: HTMLElement = toastBand()): HintHistory {
  const box = document.createElement('div');
  box.id = 'toast-history';
  box.style.cssText = 'order:2;display:flex;flex-direction:column;align-items:center;gap:4px;pointer-events:none;font:600 15px system-ui,sans-serif;color:#10141c;max-width:100%';
  parent.append(box);
  let shown = '';
  let old: { text: string; at: number }[] = []; // newest last
  return {
    update(current, _hintEl, nowMs) {
      if (current !== shown) {
        if (shown) old.push({ text: shown, at: nowMs });
        old = old.slice(-KEEP);
        shown = current;
      }
      old = old.filter((o) => nowMs - o.at < LIFE_MS && o.text !== current);
      const rows = old.slice().reverse(); // nearest the current first
      if (box.childElementCount !== rows.length || Array.from(box.children).some((c, i) => c.textContent !== rows[i].text)) {
        box.replaceChildren(...rows.map((o) => { const d = document.createElement('div'); d.textContent = o.text; d.style.cssText = 'background:#fffc;border-radius:8px;padding:4px 12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;text-align:center'; return d; }));
      }
      Array.from(box.children).forEach((c, i) => { (c as HTMLElement).style.opacity = String(DIM[i] * Math.max(0.3, 1 - (nowMs - rows[i].at) / LIFE_MS)); });
    },
  };
}
