// The strip at the top of the course picker (CC-108): four numbers for the last 24 hours, then a few lines of news.
// General numbers sit in the strip; course numbers ("12 cleared today") sit on each course card. No data, no tile: never a made-up number.
import type { WorldStats } from '../../functions/api/world-stats';
import { readStreak } from './streak';
import { secondsText } from './course-stats';
import { statKey } from './course-stats';

const n = (x: number): string => x.toLocaleString('en-US');

export interface Tile { value: string; label: string }

/** The tiles, in order of how much they say about the game right now. A tile with nothing to say is left out. */
export function tiles(s: WorldStats | null): Tile[] {
  if (!s || s.runs <= 0) return [];
  const t: Tile[] = [
    { value: n(s.players), label: s.players === 1 ? 'player today' : 'players today' },
    { value: n(s.runs), label: s.runs === 1 ? 'run today' : 'runs today' },
    { value: n(s.clears), label: 'cleared today' },
  ];
  if (s.countries > 0) t.push({ value: n(s.countries), label: s.countries === 1 ? 'country' : 'countries' });
  return t;
}

/** The news lines under the tiles: newest record, the hardest zone this week, your streak, the busiest course. */
export function news(s: WorldStats | null, streak: number): string[] {
  const out: string[] = [];
  if (s?.record) out.push(`New record: ${s.record.nick || 'someone'} ran ${s.record.course.replace(/-/g, ' ')} in ${secondsText(s.record.ticks)}.`);
  if (s?.hardest) out.push(`Hardest this week: ${s.hardest.zone.replace(/-/g, ' ')} on ${s.hardest.course} (${n(s.hardest.fails)} falls).`);
  if (s?.busiest) out.push(`Busiest today: ${s.busiest}.`);
  if (streak >= 2) out.push(`Your streak: ${streak} days in a row.`);
  return out;
}

export async function loadWorldStats(): Promise<WorldStats | null> {
  try { const r = await fetch('/api/world-stats'); return r.ok ? await r.json() as WorldStats : null; } catch { return null; }
}

/** Fills the strip, and adds "N cleared today" to each course card that someone played. Hidden until the numbers arrive. */
export function showWorldStats(strip: HTMLElement, root: HTMLElement): void {
  strip.style.display = 'none';
  void loadWorldStats().then((s) => {
    const ts = tiles(s), lines = news(s, readStreak());
    if (ts.length) {
      strip.replaceChildren();
      const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:1.2em;flex-wrap:wrap;align-items:baseline';
      for (const t of ts) {
        const b = document.createElement('div'); b.style.cssText = 'min-width:6em';
        const v = document.createElement('div'); v.textContent = t.value; v.style.cssText = 'font-size:1.6em;font-weight:700;line-height:1.1';
        const l = document.createElement('div'); l.textContent = t.label; l.style.cssText = 'font-size:.75em;opacity:.75;text-transform:uppercase;letter-spacing:.05em';
        b.append(v, l); row.append(b);
      }
      strip.append(row);
      for (const line of lines) { const p = document.createElement('div'); p.textContent = line; p.style.cssText = 'font-size:.85em;opacity:.85;margin-top:.3em'; strip.append(p); }
      strip.style.display = '';
    }
    if (s) for (const c of root.querySelectorAll<HTMLElement>('.wg-card')) {
      const v = c.dataset.value ?? '';
      const here = v.startsWith('/assets/') ? s.courses[statKey(v)] : undefined;
      if (!here || here.clears <= 0) continue;
      const e = document.createElement('em'); e.className = 'wg-today'; e.textContent = `${n(here.clears)} cleared today`;
      c.querySelector('.wg-stats')?.append(e) ?? c.querySelector('.wg-txt')?.append(e);
    }
  });
}
