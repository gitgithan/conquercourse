// Cheap checks on a submitted clear, before and around the full replay (CC-174). Pure TypeScript: no I/O, so the server, the browser and scripts share it.
// Rule of the file: only what the physics or a human body cannot do is REJECTED. A run faster than the stored ideal line is only FLAGGED:
// the ideal line is a search result, not a limit, and the replay is the judge. Every constant below is a tuning knob (see docs/run-checks.md).
import { MAX_REPLAY_TICKS, type InputLog } from './replay';
import { secondsUntilFree } from './slow-down';
import { TICKS_PER_SECOND } from './units';

/** Shortest clear we accept (0.5 s): nothing on any course is cleared faster. The shortest best line is 3.0 s. */
export const MIN_CLEAR_TICKS = 60;
/** Longest clear (2 min). Also the replay cap, so a legal log can never cost the server more than 14 400 ticks (CC-169). */
export const MAX_CLEAR_TICKS = Math.min(MAX_REPLAY_TICKS, 120 * 120);
/** Fastest average speed in m/s the simulator can reach: 1.05 x the fastest best line stored (the coaster, 9.07 m/s). Raise it with the stored plans. */
export const MAX_AVG_SPEED = 9.55;
/** More key changes per second than this over a whole run is not a person. The busiest best line has 1.9. */
export const MAX_CHANGES_PER_SECOND = 15;
/** And at most this many changes inside any single second (a very fast mash is about 20). The busiest best line has 5. */
export const MAX_CHANGES_IN_ONE_SECOND = 30;
/** SOFT flag, never a rejection: a clear with fewer ticks than the stored best line x this is flagged "beats the ideal" for human review. */
export const BEATS_IDEAL_FACTOR = 0.98;
/** A claimed tick count may be this much shorter than the keys sent (keys held after the finish). */
export const TAIL_SLACK_TICKS = TICKS_PER_SECOND;
/** Replays are the costly part: at most this many submissions per address in the window. */
export const REPLAYS_PER_ADDRESS = 20;
export const REPLAY_WINDOW_MS = 10 * 60_000;

export type Reject = 'too-short' | 'too-long' | 'too-fast' | 'key-rate' | 'structure';
export type Verdict = { ok: true; beatsIdeal: boolean } | { ok: false; code: Reject; why: string };

export const logTicks = (log: InputLog): number => log.reduce((s, [, n]) => s + n, 0);

/** Key changes: in total, per second over the run, and the most inside one second. */
export function changeStats(log: InputLog): { total: number; perSecond: number; peak: number } {
  const at: number[] = [];
  let t = 0;
  for (let i = 0; i < log.length - 1; i++) { t += log[i][1]; at.push(t); }
  let peak = 0;
  for (let i = 0, j = 0; i < at.length; i++) { while (at[i] - at[j] >= TICKS_PER_SECOND) j++; peak = Math.max(peak, i - j + 1); }
  const secs = Math.max(1, logTicks(log)) / TICKS_PER_SECOND;
  return { total: at.length, perSecond: at.length / secs, peak };
}

/** The fewest ticks the physics allows over this course: the distance at the top average speed. */
export const physicsFloorTicks = (c: { startX: number; finishX: number }): number =>
  Math.max(MIN_CLEAR_TICKS, Math.floor(((c.finishX - c.startX) / MAX_AVG_SPEED) * TICKS_PER_SECOND));

/** Soft flag: true when the time beats the stored best line by more than the margin. False when the course has no stored best line. */
export const beatsIdeal = (ticks: number, idealTicks: number | null | undefined): boolean =>
  typeof idealTicks === 'number' && idealTicks > 0 && ticks < Math.floor(idealTicks * BEATS_IDEAL_FACTOR);

export interface RunInput { log: InputLog; course: { startX: number; finishX: number }; idealTicks?: number | null; claimedTicks?: number }

/** The cheap pre-filter. Rejects only the impossible; reports the soft "beats the ideal" flag for the rest. */
export function checkRun(r: RunInput): Verdict {
  const total = logTicks(r.log);
  if (!r.log.length || total < 1) return { ok: false, code: 'structure', why: 'no keys' };
  if (r.log.some(([m, n]) => !Number.isInteger(m) || !Number.isInteger(n) || m < 0 || n < 1)) return { ok: false, code: 'structure', why: 'bad run-length entry' };
  if (r.log.some((e, i) => i > 0 && e[0] === r.log[i - 1][0])) return { ok: false, code: 'structure', why: 'equal neighbours are one entry' };
  if (r.claimedTicks !== undefined && !(r.claimedTicks >= 1 && total >= r.claimedTicks && total <= r.claimedTicks + TAIL_SLACK_TICKS)) return { ok: false, code: 'structure', why: 'keys and claimed ticks differ' };
  // the run cannot be longer than the keys sent, and a lying claim only lowers the number we judge by
  const ticks = Math.min(total, r.claimedTicks ?? total);
  if (ticks < MIN_CLEAR_TICKS) return { ok: false, code: 'too-short', why: `${ticks} ticks` };
  if (total > MAX_CLEAR_TICKS) return { ok: false, code: 'too-long', why: `${total} ticks` };
  if (ticks < physicsFloorTicks(r.course)) return { ok: false, code: 'too-fast', why: `${ticks} ticks is over ${MAX_AVG_SPEED} m/s` };
  const c = changeStats(r.log);
  if (c.perSecond > MAX_CHANGES_PER_SECOND || c.peak > MAX_CHANGES_IN_ONE_SECOND) return { ok: false, code: 'key-rate', why: `${c.perSecond.toFixed(1)} changes/s, ${c.peak} in one second` };
  return { ok: true, beatsIdeal: beatsIdeal(ticks, r.idealTicks) };
}

/** Per-address limiter (the pattern of the other functions: kept in memory of one Worker, so it slows a flood, it does not stop one). */
export function rateLimited(hits: Map<string, number[]>, key: string, now: number, max = REPLAYS_PER_ADDRESS, windowMs = REPLAY_WINDOW_MS): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) { hits.set(key, recent); return true; }
  recent.push(now); hits.set(key, recent);
  return false;
}

/** After rateLimited said yes: seconds until the address may try again (the oldest hit in the window leaves). */
export function rateWaitSeconds(hits: Map<string, number[]>, key: string, now: number, windowMs = REPLAY_WINDOW_MS): number {
  return secondsUntilFree(hits.get(key) ?? [], now, windowMs);
}
