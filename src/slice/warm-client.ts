import { flag } from '../flags';

// Warm-up (CC-133): wake a photo machine early so its model is already loaded when the player needs it.
// Fire and forget: at most once per page load for each machine, a failure is ignored, and ?warmup=0 turns it off.
export type Which = 'mask' | 'lift';
const sent = new Set<Which>();

export function warmUp(which: Which, send: typeof fetch = fetch, off: boolean = flag('warmup') === '0'): boolean {
  if (off || sent.has(which)) return false;
  sent.add(which);
  try { void Promise.resolve(send('/api/segment', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'warm', which }), keepalive: true })).catch(() => {}); } catch { /* never blocks the page */ }
  return true;
}

/** For tests: forget what was sent. */
export const resetWarmUp = (): void => sent.clear();
