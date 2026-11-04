import type { Window } from '../sim/ideal';

/** Name the simulator's measured press; never infer its identity from the window width. */
export function timingName(obstacle: string): string {
  const bar = /^hang on bar (\d+)$/.exec(obstacle);
  if (bar) return `Release from Bar ${bar[1]}`;
  const at = /(?:edge|step) at (-?[\d.]+) m/.exec(obstacle);
  const place = at ? ` at ${at[1]} m` : '';
  if (obstacle.startsWith('vault at ')) return `Vault press${place}`;
  if (obstacle.startsWith('climb at ')) return `Grab and climb press${place}`;
  if (obstacle.startsWith('jump at ') || obstacle.startsWith('edge at ') || obstacle.endsWith('(take-off)')) return `Jump take-off${place}`;
  const names: Record<string, string> = {
    'bars: hang before the first reach': 'Wait before the first monkey-bar reach',
    'bars: release after the last reach': 'Release after the last monkey-bar reach',
    'bars: narrowest reach': 'Hardest monkey-bar reach',
    'trebuchet release': 'Trebuchet release', 'band stretch': 'Elastic-band stretch', 'braking point': 'Coaster braking',
  };
  return names[obstacle] ?? obstacle.charAt(0).toUpperCase() + obstacle.slice(1);
}

// Name both minima independently: a new obstacle or move may become the hardest press after an edit.
export function timingComparison(before: Window, after: Window): string[] {
  return [
    `Before: ${timingName(before.obstacle)} — ${Math.round(before.widthMs)} ms.`,
    `After: ${timingName(after.obstacle)} — ${Math.round(after.widthMs)} ms.`,
    `The hardest press has ${Math.round(after.widthMs) - Math.round(before.widthMs)} ms more room.`,
  ];
}
