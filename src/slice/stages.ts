// Plain-words stages for the two Modal jobs (CC-247, CC-248) and the "try again at HH:MM" sentences for a refused request.
// Pure, so the words and the clock are tested without a browser or a server (tests/stages.test.ts).

export interface Step { id: string; words: string }

/** The stage names the lift job writes (pipelines/photo_to_object.py: `_stage`), in order. "checking" is the time before the job reports anything. */
export const LIFT_STEPS: Step[] = [
  { id: 'checking', words: 'Checking the photo' },
  { id: 'cutting', words: 'Cutting out the object' },
  { id: 'shape', words: 'Building the 3D shape' },
  { id: 'colour', words: 'Adding colour' },
  { id: 'done', words: 'Done' },
];
export const SEGMENT_STEPS: Step[] = [
  { id: 'checking', words: 'Checking the photo' },
  { id: 'finding', words: 'Finding the things in it' },
  { id: 'done', words: 'Done' },
];

/** Where a reported stage sits in the steps; a missing or unknown name is the first step, and the page never moves backwards (`atLeast`). */
export function stageIndex(steps: Step[], raw: unknown, atLeast = 0): number {
  const i = typeof raw === 'string' ? steps.findIndex((s) => s.id === raw) : -1;
  return Math.max(atLeast, i < 0 ? 0 : i);
}

export interface Progress { index: number; total: number; words: string; seconds: number }
export const progressOf = (steps: Step[], index: number, startedMs: number, nowMs = Date.now()): Progress =>
  ({ index, total: steps.length, words: steps[Math.min(index, steps.length - 1)].words, seconds: Math.max(0, Math.round((nowMs - startedMs) / 1000)) });

// ---- when to try again ----
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const two = (n: number): string => String(n).padStart(2, '0');

/** The next midnight UTC, in whole seconds from `now`: when the daily slots come back. */
export const secondsToNextDay = (now: number): number => Math.max(1, Math.ceil((Math.floor(now / 86_400_000) * 86_400_000 + 86_400_000 - now) / 1000));

/**
 * "Try again at 14:30" in the player's own clock, "tomorrow at 02:00" when it is on the next local day, "on 3 Nov at 02:00" after that.
 * The minute is rounded up, so the time is never too early. `offsetMin` is minutes east of UTC; the default is the browser's own.
 */
export function tryAgainAt(whenMs: number, nowMs = Date.now(), offsetMin?: number): string {
  const when = Math.ceil(whenMs / 60_000) * 60_000;
  const off = (offsetMin ?? -new Date(when).getTimezoneOffset()) * 60_000;
  const w = new Date(when + off), days = Math.floor((when + off) / 86_400_000) - Math.floor((nowMs + off) / 86_400_000);
  const clock = `${two(w.getUTCHours())}:${two(w.getUTCMinutes())}`;
  if (days <= 0) return `Try again at ${clock}`;
  if (days === 1) return `Try again tomorrow at ${clock}`;
  return `Try again on ${w.getUTCDate()} ${MONTHS[w.getUTCMonth()]} at ${clock}`;
}

/** What a refused request (HTTP 429 and the like) puts in its body: the kind, a sentence, and how many seconds until it may work. */
export interface Refusal { error: string; message?: string; retryAfterSeconds?: number }
export const refusalBody = (error: 'daily' | 'budget' | 'busy' | 'down', message: string, retryAfterSeconds: number): Required<Refusal> => ({ error, message, retryAfterSeconds: Math.max(1, Math.round(retryAfterSeconds)) });

const REFUSALS: Record<string, string> = {
  daily: 'You have used all of your 3D pieces for today.',
  budget: "Everyone together has used up today's 3D pieces.",
  busy: 'You asked for a lot in a short time.',
  down: 'The 3D maker is busy right now.',
};

/** The sentence the player reads for a refused request. Falls back to the server's own words when the reply has no wait time. */
export function refusalWords(r: Refusal, nowMs = Date.now(), offsetMin?: number): string {
  const base = REFUSALS[r.error];
  if (!base || typeof r.retryAfterSeconds !== 'number' || !(r.retryAfterSeconds > 0)) return r.message || base || '';
  const again = `${tryAgainAt(nowMs + r.retryAfterSeconds * 1000, nowMs, offsetMin)}.`;
  return r.error === 'daily' || r.error === 'budget' ? `${base} ${again} Meanwhile, pick a piece from the library.` : `${base} ${again}`;
}
