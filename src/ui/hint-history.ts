// The hint history: the current hint stays where it is; the toasts before it scroll up above it and dim, then fade away.
// It only reads the hint text and the hint box's place; it never changes the hint.
export interface HintHistory { update(current: string, hintEl: HTMLElement, nowMs: number): void }
const KEEP = 3, LIFE_MS = 9000, DIM = [0.6, 0.38, 0.22];

export function createHintHistory(parent: HTMLElement): HintHistory {
  const box = document.createElement('div');
  box.id = 'toast-history';
  box.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:4px;pointer-events:none;font:600 15px system-ui,sans-serif;color:#10141c;z-index:5';
  parent.append(box);
  let shown = '';
  let old: { text: string; at: number }[] = []; // newest last
  return {
    update(current, hintEl, nowMs) {
      if (current !== shown) {
        if (shown) old.push({ text: shown, at: nowMs });
        old = old.slice(-KEEP);
        shown = current;
      }
      old = old.filter((o) => nowMs - o.at < LIFE_MS && o.text !== current);
      const visible = hintEl.style.display !== 'none' && current !== '';
      const bottom = parseFloat(hintEl.style.bottom) || 190;
      box.style.bottom = `${bottom + (visible ? hintEl.offsetHeight + 8 : 0)}px`;
      const rows = old.slice().reverse(); // nearest the current first
      if (box.childElementCount !== rows.length || Array.from(box.children).some((c, i) => c.textContent !== rows[rows.length - 1 - i].text)) {
        box.replaceChildren(...rows.slice().reverse().map((o) => { const d = document.createElement('div'); d.textContent = o.text; d.style.cssText = 'background:#fffc;border-radius:8px;padding:4px 12px;white-space:pre-line;text-align:center'; return d; }));
      }
      Array.from(box.children).forEach((c, i) => { const k = rows.length - 1 - i; (c as HTMLElement).style.opacity = String(DIM[k] * Math.max(0.3, 1 - (nowMs - rows[k].at) / LIFE_MS)); });
    },
  };
}
