// CC-133: the toasts show "N-back with N = 2": the message now is in the main slot, the 2 messages before it sit dimmed above it
// (the older, the dimmer). A new message dims the one on screen and moves it up a slot; the oldest drops off; the new one takes the main slot.
// Pure: time is passed in, so a test or the stepped clock decides when. The DOM view is in hint-history.ts.
export const NBACK_N = 2;
export const NBACK_LIFE_MS = 9000; // a dimmed message fades away this long after it was replaced
export const NBACK_DIM = [0.62, 0.34]; // opacity of the newest and the older previous message

export interface NBackItem { id: number; text: string; at: number }
export interface NBackState { current: string; prev: NBackItem[]; nextId: number } // prev: oldest first

export const nbackStart = (): NBackState => ({ current: '', prev: [], nextId: 1 });

/** A message arrives (an empty text means nothing is on screen now). The same text again changes nothing. */
export function nbackPush(s: NBackState, text: string, now: number): NBackState {
  if (text === s.current) return s;
  let prev = s.prev.filter((p) => p.text !== text); // a message that comes back is current again, not also a dimmed copy
  let nextId = s.nextId;
  if (s.current) { prev = [...prev.filter((p) => p.text !== s.current), { id: nextId++, text: s.current, at: now }]; }
  return { current: text, prev: prev.slice(-NBACK_N), nextId };
}

export interface NBackRow { id: number; text: string; opacity: number; slot: number } // slot 1 = just above the main slot, 2 = the one above that

/** The dimmed rows, top to bottom, with their opacity at time `now`; rows older than the life are gone. */
export function nbackRows(s: NBackState, now: number): NBackRow[] {
  const live = s.prev.filter((p) => now - p.at < NBACK_LIFE_MS);
  return live.map((p) => {
    const slot = s.prev.length - s.prev.indexOf(p); // 1 = newest
    return { id: p.id, text: p.text, slot, opacity: NBACK_DIM[slot - 1] * Math.max(0.3, 1 - (now - p.at) / NBACK_LIFE_MS) };
  });
}
