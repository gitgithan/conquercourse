// The message history, drawn (CC-133): the 2 messages before the current one sit dimmed above it in the sky band, the older the dimmer (the N-back logic is in nback.ts).
// It only reads the message text; it never changes the hint. The two rows keep their space even when empty, so the main slot never jumps.
import { toastBand } from './toast-band';
import { nbackPush, nbackRows, nbackStart, NBACK_N, type NBackState } from './nback';

export interface HintHistory { update(current: string, hintEl: HTMLElement, nowMs: number): void }
export const HISTORY_ROW_PX = 22, HISTORY_GAP_PX = 2;
export const HISTORY_HEIGHT_PX = NBACK_N * HISTORY_ROW_PX + (NBACK_N - 1) * HISTORY_GAP_PX; // the space the dimmed rows keep above the main slot

export function createHintHistory(parent: HTMLElement = toastBand()): HintHistory {
  const style = document.createElement('style');
  style.textContent = '@keyframes nbin{from{opacity:0;transform:translateY(24px)}to{transform:translateY(0)}}';
  document.head.append(style);
  const box = document.createElement('div');
  box.id = 'toast-history';
  box.style.cssText = `order:-1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:${HISTORY_GAP_PX}px;height:${HISTORY_HEIGHT_PX}px;overflow:hidden;pointer-events:none;font:600 13px system-ui,sans-serif;color:#10141c;max-width:100%;width:100%`;
  parent.append(box);
  const nodes = new Map<number, HTMLElement>();
  let s: NBackState = nbackStart();
  return {
    update(current, _hintEl, nowMs) {
      s = nbackPush(s, current, nowMs);
      const rows = nbackRows(s, nowMs); // oldest first: the oldest is the top row
      const keep = new Set(rows.map((r) => r.id));
      for (const [id, n] of nodes) if (!keep.has(id)) { n.remove(); nodes.delete(id); }
      for (const r of rows) {
        let n = nodes.get(r.id);
        if (!n) {
          n = document.createElement('div'); n.textContent = r.text;
          n.style.cssText = `background:#fffc;border-radius:8px;padding:0 12px;height:${HISTORY_ROW_PX}px;line-height:${HISTORY_ROW_PX}px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;text-align:center;box-sizing:border-box;flex:none;animation:nbin .35s ease-out;transition:opacity .35s`;
          nodes.set(r.id, n);
          box.append(n); // a new row is always the newest: it joins at the bottom, just above the main slot (never re-appended, or its slide would restart each frame)
        }
        n.style.opacity = String(r.opacity);
      }
    },
  };
}
