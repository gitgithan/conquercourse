import { pageSearch } from '../flags';
// CC-183: gold means one thing: the obstacle where the player fell most in this session (ties: the latest fall; no falls: no gold).
export interface Hardest { id: string; falls: number }

/** `log` holds one zone id per fall, oldest first. */
export function hardestOf(log: readonly string[]): Hardest | null {
  const n = new Map<string, number>(), last = new Map<string, number>();
  log.forEach((id, i) => { n.set(id, (n.get(id) ?? 0) + 1); last.set(id, i); });
  let best: Hardest | null = null;
  for (const [id, falls] of n) if (!best || falls > best.falls || (falls === best.falls && last.get(id)! > last.get(best.id)!)) best = { id, falls };
  return best;
}

export const hardestLabel = (name: string, falls: number) => `Hardest for you: ${name.charAt(0).toUpperCase()}${name.slice(1)} (${falls} ${falls === 1 ? 'fall' : 'falls'})`;
export const GOLD_LEGEND = 'Gold marks the obstacle you fell at most this session.';

/** ?gold=old keeps the old look: gold on every obstacle still to do, and on the shortcut line. */
export const goldOld = (search: string = typeof location === 'undefined' ? '' : pageSearch()) => new URLSearchParams(search).get('gold') === 'old';

/** The report block: gold, with the label and the legend line. */
export function hardestBlock(name: string, falls: number): HTMLElement {
  const b = document.createElement('div'); b.id = 'hardest-block';
  b.style.cssText = 'background:#fff8dc;border-left:4px solid #d9a521;padding:8px 10px;border-radius:6px;font-size:15px';
  const t = document.createElement('div'); t.style.fontWeight = '700'; t.textContent = hardestLabel(name, falls);
  const l = document.createElement('div'); l.style.cssText = 'font-size:13px;color:#58635d'; l.textContent = GOLD_LEGEND;
  b.append(t, l); return b;
}
