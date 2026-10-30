import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { OBSTACLES, TOASTS, column } from '../src/course/obstacles';
import { ZONE_ICONS } from '../src/ui/zone-icons';
import { LEARNED, SAYING } from '../src/ui/run-report';
import { leadOf, toastKindOf, APPROACH_LEAD, TRAMPOLINE_LEAD } from '../src/ui/approach-toast';
import type { Drum } from '../src/sim/drums';

// The words and pictures were recorded from the code before they moved into rows; they must not change.
const gold = JSON.parse(readFileSync('tests/golden/obstacle-text.json', 'utf8')) as Record<string, Record<string, string>>;

describe('obstacle rows', () => {
  it('give back exactly the icons, learned lines and sayings recorded before the move', () => {
    expect(ZONE_ICONS).toEqual(gold.icons);
    expect(LEARNED).toEqual(gold.learned);
    expect(SAYING).toEqual(gold.saying);
  });
  it('give back the toast texts recorded before the move', () => {
    const text = Object.fromEntries(Object.entries(TOASTS).map(([k, r]) => [k, r.text]));
    expect(text).toEqual(gold.toastText);
  });
  it('keep the toast lead: 12 m, and 14 m for the trampoline only', () => {
    for (const k of Object.keys(TOASTS) as (keyof typeof TOASTS)[]) expect(leadOf(k)).toBe(k === 'bounce' ? TRAMPOLINE_LEAD : APPROACH_LEAD);
  });
  it('map each direct drum kind to its toast, and nothing else', () => {
    const c = {} as never;
    for (const what of ['vault', 'roll', 'jump', 'bounce'] as const) expect(toastKindOf(c, { x: 1, what } as Drum)).toBe(what);
    for (const what of ['let go', 'release', 'fire', 'aim', 'turn', 'board'] as const) expect(toastKindOf(c, { x: 1, what } as Drum)).toBeNull();
  });
  it('match a grab drum to its zone by id prefix, in the order of the rows', () => {
    const z = (id: string) => ({ zones: [{ id, x0: 0, x1: 10 }] }) as never;
    for (const k of ['wall', 'climb', 'lache', 'rope']) {
      expect(toastKindOf(z(k), { x: 5, what: 'grab' } as Drum)).toBe(k);
      expect(toastKindOf(z(k + '-2'), { x: 5, what: 'grab' } as Drum)).toBe(k);
    }
  });
  it('have a picture for every machine, and every row field is a non-empty string', () => {
    for (const id of ['band', 'drone', 'plank', 'recoil', 'launch', 'coaster'] as const) expect(OBSTACLES[id].icon ?? ZONE_ICONS[id]).toBeTruthy();
    for (const f of ['icon', 'learned', 'saying'] as const) for (const v of Object.values(column(f))) expect(v.length).toBeGreaterThan(5);
  });
});
