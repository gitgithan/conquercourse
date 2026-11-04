import { LAB_GROUPS, LAB_LIST, TIERS } from './labs-series';

// CC-133: the Labs list as plain data (numbers, neighbours, the grouped layout); labs-nav.ts and labs-panel.ts both read it.
export const LABS: readonly { mode: string; name: string }[] = LAB_LIST; // number = place in the list (stable); the sections come from labs-series.ts

export const labNumber = (mode: string): number => LABS.findIndex((l) => l.mode === mode) + 1; // 0 when it is not a Lab
export const labHref = (mode: string): string => `?mode=${mode}&labs=1&welcome=0`;

/** The Labs either side of this one; the ends do not wrap, so the buttons switch off there. */
export function labNeighbours(mode: string): { prev: string | null; next: string | null } {
  const i = labNumber(mode) - 1;
  if (i < 0) return { prev: null, next: null };
  return { prev: LABS[i - 1]?.mode ?? null, next: LABS[i + 1]?.mode ?? null };
}

export interface NavTier { id: string; title: string; groups: { id: string; title: string; labs: { n: number; mode: string; name: string }[] }[] }
/** The strip's layout as data: one block per tier, one run of chips per sub-header (empty ones left out), every Lab once, in number order inside its sub-header. */
export function navLayout(): NavTier[] {
  return TIERS.map((t) => ({
    id: t.id, title: t.title,
    groups: LAB_GROUPS.filter((g) => g.tier === t.id && g.modes.length).map((g) => ({
      id: g.id, title: g.title,
      labs: [...g.modes].map((m) => ({ n: labNumber(m), mode: m, name: LAB_LIST.find((l) => l.mode === m)!.name })).sort((x, y) => x.n - y.n),
    })),
  })).filter((t) => t.groups.length);
}

