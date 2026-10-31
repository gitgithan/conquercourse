// The starter cast: eight characters made and fitted for the game, shipped with it, so the Characters picker is never empty (CC-108).
// They are ordinary made characters: same 34 bones, same size caps, and the same fit to the one skeleton when they load.
import { flag } from '../flags';
import type { CharacterCard } from './steps';

export const CAST_BASE = '/assets/characters/cast';
/** The starter cast shows unless the address says ?cast=0. */
export const castOn = (value: string | null = flag('cast')): boolean => value !== '0';
export const castUrl = (id: string): string => `${CAST_BASE}/${id}.glb`;

interface CastEntry { id: string; name: string; prompt: string; bytes: number; thumb: string }

/** The cast as picker cards. Never throws: no list means no cards. */
export async function loadCast(fetcher: typeof fetch = fetch): Promise<CharacterCard[]> {
  try {
    const r = await fetcher(`${CAST_BASE}/index.json`);
    if (!r.ok) return [];
    const { items } = await r.json() as { items: CastEntry[] };
    return items.map((c) => ({ id: c.id, kind: 'character', name: c.name, prompt: c.prompt, provider: 'starter', route: 'A', bytes: c.bytes, faces: 2910, picks: 0, keeper: true, ts: '', mine: false, thumb: `${CAST_BASE}/${c.thumb}` }));
  } catch { return []; }
}

export const isCast = (id: string, cast: CharacterCard[]): boolean => cast.some((c) => c.id === id);
