// Which runner the player chose, and how the game loads it (CC-108).
// Nothing is fetched until a character is picked (lazy), the choice is kept per browser, and a frame-rate guard sends a slow machine back to the Rookie.
import { flag } from '../flags';
import { castUrl } from './cast';

export const CHOICE_KEY = 'cc.character';
export const MAX_SLOW_FRAME_MS = 60; // a median frame slower than this (under about 17 frames a second) sends the player back to the Rookie

/** The Characters button shows unless the address says ?characters=0. */
export const charactersOn = (value: string | null = flag('characters')): boolean => value !== '0';
/** ?charguard=0 turns the frame-rate guard off (a software-GPU test machine is always slow). */
export const guardOn = (value: string | null = flag('charguard')): boolean => value !== '0';

export function savedChoice(store: Pick<Storage, 'getItem'> | null = safeStore()): string | null {
  try { const v = store?.getItem(CHOICE_KEY) ?? null; return v && /^[0-9a-f]{16}$/.test(v) ? v : null; } catch { return null; }
}
export function saveChoice(id: string | null, store: Pick<Storage, 'setItem' | 'removeItem'> | null = safeStore()): void {
  try { if (id) store?.setItem(CHOICE_KEY, id); else store?.removeItem(CHOICE_KEY); } catch { /* private window: the pick lasts for this visit only */ }
}
function safeStore(): Storage | null { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } }

/** The median of the frame times, in ms (pure, so a test can check the guard's rule). */
export function slowMedian(frameMs: number[]): number {
  const s = [...frameMs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}
export const tooSlow = (frameMs: number[], limit = MAX_SLOW_FRAME_MS): boolean => frameMs.length >= 30 && slowMedian(frameMs) > limit;

/** Fetch one character's file when it is picked; returns a blob URL the Rookie loader can read, or null with a plain reason. */
export async function fetchCharacterUrl(id: string, fetcher: typeof fetch = fetch, cast: { id: string }[] = []): Promise<{ url: string } | { error: string }> {
  if (cast.some((c) => c.id === id)) return { url: castUrl(id) }; // a starter-cast character is a file of the site, not a row on the server
  try {
    const r = await fetcher(`/api/character?id=${id}`);
    if (!r.ok) return { error: 'That character is not there any more.' };
    return { url: URL.createObjectURL(new Blob([await r.arrayBuffer()], { type: 'model/gltf-binary' })) };
  } catch { return { error: 'Could not load that character. You are running as the Rookie.' }; }
}

/** Watch the next `frames` frames; call back with the verdict. Stops early if the page is hidden. */
export function watchFrames(frames: number, done: (ms: number[]) => void, raf: (cb: FrameRequestCallback) => number = requestAnimationFrame): void {
  const times: number[] = []; let last = 0;
  const step = (t: number) => {
    if (last) times.push(t - last);
    last = t;
    if (times.length >= frames) done(times); else raf(step);
  };
  raf(step);
}
