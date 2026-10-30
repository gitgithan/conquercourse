// "In the last 24 hours: 1,204 players made 9,310 runs." One line on the course picker (CC-108). No data, no line: never a made-up number.
import type { WorldStats } from '../../functions/api/world-stats';

const n = (x: number): string => x.toLocaleString('en-US');

export function worldLine(s: WorldStats | null): string | null {
  if (!s || s.runs <= 0) return null;
  const who = `${n(s.players)} ${s.players === 1 ? 'player' : 'players'}`;
  const tail = s.busiest ? ` Busiest: ${s.busiest}.` : '';
  return `In the last 24 hours: ${who} made ${n(s.runs)} ${s.runs === 1 ? 'run' : 'runs'}, ${n(s.clears)} cleared.${tail}`;
}

export async function loadWorldStats(): Promise<WorldStats | null> {
  try { const r = await fetch('/api/world-stats'); return r.ok ? await r.json() as WorldStats : null; } catch { return null; }
}

/** Fills `el` when the numbers arrive; hidden until then. */
export function showWorldStats(el: HTMLElement): void {
  el.style.display = 'none';
  void loadWorldStats().then((s) => { const t = worldLine(s); if (t) { el.textContent = t; el.style.display = ''; } });
}
