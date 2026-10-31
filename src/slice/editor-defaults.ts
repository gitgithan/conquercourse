// What the World Editor starts with (CC-200, owner 2026-11-01): the Design partner hidden, the water level at 0, and a labelled start.

export const DEFAULT_WATER_LEVEL = 0; // m: a new world's water sits at the ground; the simulator reads the same number from the saved course
export const PARTNER_PREF_KEY = 'cc.partner.pref'; // set only when the player opens or closes the partner by hand; a self-opened partner is never kept
export const START_LABEL = 'Start: the runner begins here';
export const START_SHORT = 'Start';

// Hidden unless the player chose to open it by hand last time.
export const partnerStartsOpen = (stored: string | null | undefined): boolean => stored === '1';

// A saved world keeps its own level; only a world with none gets the default.
export const levelOfSaved = (saved: { level?: unknown } | null | undefined): number =>
  typeof saved?.level === 'number' && Number.isFinite(saved.level) ? saved.level : DEFAULT_WATER_LEVEL;

// Where the side view puts its Start flag: the first piece of ground the runner stands on (metres along the lane, height above the water).
export function startMarkSide(prof: { cells: (number | null)[]; origin?: number }, cell: number): { u: number; h: number } | null {
  const i = prof.cells.findIndex((h) => h !== null);
  return i < 0 ? null : { u: (prof.origin ?? 0) + i * cell, h: prof.cells[i] as number };
}
