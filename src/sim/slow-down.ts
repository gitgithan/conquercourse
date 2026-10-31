// When a server step turns a request away because there were too many, it says when to come back (CC-219, CC-108).
// Pure helpers: the server builds the reply, the page reads it and words it, and the tests drive them with a stubbed clock.

export const SLOW_DOWN = 'slow_down';
const LONGEST_WAIT = 3600; // seconds: no wait is ever promised longer than an hour

/** Whole seconds until the oldest hit in the window leaves it, at least 1 (the window's real reset, never a guess). */
export function secondsUntilFree(times: number[], now: number, windowMs: number): number {
  const recent = times.filter((t) => now - t < windowMs);
  if (recent.length === 0) return 1;
  return Math.min(LONGEST_WAIT, Math.max(1, Math.ceil((Math.min(...recent) + windowMs - now) / 1000)));
}

/** The 429 every limited share or publish sends: a Retry-After header and the same number in the body. */
export function slowDownReply(seconds: number): { body: { error: string; reason: string; retryAfterSeconds: number }; headers: Record<string, string> } {
  const s = Math.min(LONGEST_WAIT, Math.max(1, Math.ceil(seconds)));
  return { body: { error: 'slow down', reason: SLOW_DOWN, retryAfterSeconds: s }, headers: { 'retry-after': String(s) } };
}

/** "about 40 seconds", "about 1 minute", "about 3 minutes", rounded up so the player never comes back too early. */
export function waitWords(seconds: number): string {
  const s = Math.max(1, Math.ceil(seconds));
  if (s < 60) return s <= 5 ? 'a few seconds' : `about ${Math.ceil(s / 5) * 5} seconds`;
  const m = Math.ceil(s / 60);
  return m === 1 ? 'about 1 minute' : `about ${m} minutes`;
}

/** The sentence under a share button when the server asked for a pause. */
export const shareWaitText = (seconds: number): string => `Too many shares just now. Your run is safe: try again in ${waitWords(seconds)}.`;

/** The seconds a refused reply asks for: the body first, then the Retry-After header; null when it asks for nothing. */
export function waitFromReply(status: number, body: unknown, header?: string | null): number | null {
  if (status !== 429) return null;
  const n = Number((body as { retryAfterSeconds?: unknown } | null)?.retryAfterSeconds ?? header);
  return Number.isFinite(n) && n > 0 ? Math.min(LONGEST_WAIT, Math.ceil(n)) : 60; // a 429 with no number still gets a safe wait
}

/** "38 s" for a button label that counts down. */
export const countdownLabel = (seconds: number): string => (seconds >= 120 ? `${Math.ceil(seconds / 60)} min` : `${Math.max(1, Math.ceil(seconds))} s`);
