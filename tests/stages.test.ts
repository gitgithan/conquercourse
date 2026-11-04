import { describe, expect, it } from 'vitest';
import { LIFT_STEPS, SEGMENT_STEPS, progressOf, refusalBody, refusalWords, secondsToNextDay, stageIndex, tryAgainAt } from '../src/slice/stages';
import { submitFailure } from '../src/slice/object-lift-client';

// "Try again at HH:MM" is in the player's own clock, so these pin the offset (minutes east of UTC) and do not depend on this machine's zone.
const utc = (d: number, h: number, m = 0) => Date.UTC(2026, 9, d, h, m);

describe('stage words (the Modal job writes the names, the page shows the words)', () => {
  it('has the five plain stages for a piece and three for an outline', () => {
    expect(LIFT_STEPS.map((s) => s.words)).toEqual(['Checking the photo', 'Cutting out the object', 'Building the 3D shape', 'Adding colour', 'Done']);
    expect(SEGMENT_STEPS.map((s) => s.id)).toEqual(['checking', 'finding', 'done']);
  });
  it('maps a reported stage to its place, and a missing or unknown one to the first', () => {
    expect(stageIndex(LIFT_STEPS, 'shape')).toBe(2);
    expect(stageIndex(LIFT_STEPS, undefined)).toBe(0);
    expect(stageIndex(LIFT_STEPS, 'nonsense')).toBe(0);
    expect(stageIndex(LIFT_STEPS, 42)).toBe(0);
    expect(stageIndex(SEGMENT_STEPS, 'finding')).toBe(1);
  });
  it('never moves backwards when an older answer arrives late', () => {
    expect(stageIndex(LIFT_STEPS, 'cutting', 2)).toBe(2);
    expect(stageIndex(LIFT_STEPS, undefined, 3)).toBe(3);
  });
  it('counts the seconds and names the step', () => {
    expect(progressOf(LIFT_STEPS, 1, 1000, 15_400)).toEqual({ index: 1, total: 5, words: 'Cutting out the object', seconds: 14 });
    expect(progressOf(LIFT_STEPS, 99, 0, 0).words).toBe('Done');
  });
});

describe('try again at HH:MM, in the player\'s own time', () => {
  const now = utc(31, 12, 0);
  it('says the clock time the same day', () => {
    expect(tryAgainAt(utc(31, 14, 30), now, 0)).toBe('Try again at 14:30');
    expect(tryAgainAt(utc(31, 14, 30), now, 480)).toBe('Try again at 22:30');
  });
  it('uses the local date, so the same instant can be today for one player and tomorrow for another', () => {
    const when = utc(31, 20, 0);
    expect(tryAgainAt(when, now, 0)).toBe('Try again at 20:00');
    expect(tryAgainAt(when, now, 480)).toBe('Try again tomorrow at 04:00'); // 12:00 UTC is 20:00 local on the 31st; 20:00 UTC is 04:00 on the 1st
    expect(tryAgainAt(when, now, -300)).toBe('Try again at 15:00');
  });
  it('says tomorrow after local midnight and the date after that', () => {
    expect(tryAgainAt(utc(31, 23, 59), utc(31, 23, 0), 0)).toBe('Try again at 23:59');
    expect(tryAgainAt(utc(32, 1, 5), utc(31, 23, 0), 0)).toBe('Try again tomorrow at 01:05');
    expect(tryAgainAt(utc(34, 9, 0), utc(31, 23, 0), 0)).toBe('Try again on 3 Nov at 09:00');
  });
  it('rounds the minute up, so the time is never too early', () => {
    expect(tryAgainAt(utc(31, 14, 30) + 1000, now, 0)).toBe('Try again at 14:31');
    expect(tryAgainAt(utc(31, 14, 30), now, 0)).toBe('Try again at 14:30');
  });
  it('knows when the daily slots come back: the next midnight UTC', () => {
    expect(secondsToNextDay(utc(31, 22, 30))).toBe(90 * 60);
    expect(secondsToNextDay(utc(31, 0, 0))).toBe(86_400);
  });
});

describe('refusal sentences', () => {
  const now = utc(31, 22, 30);
  it('the personal daily limit says it is yours, gives the clock time and points to the library', () => {
    const w = refusalWords({ error: 'daily', retryAfterSeconds: 5400 }, now, 0);
    expect(w).toMatch(/all of your 3D pieces for today/); expect(w).toMatch(/Try again tomorrow at 00:00\./); expect(w).toMatch(/library/);
  });
  it('the global daily limit says everyone has used it, not you', () => {
    const w = refusalWords({ error: 'budget', retryAfterSeconds: 5400 }, now, 0);
    expect(w).toMatch(/Everyone together/); expect(w).toMatch(/Try again tomorrow at 00:00/);
  });
  it('a busy service or a burst says when to try, in local time', () => {
    expect(refusalWords({ error: 'busy', retryAfterSeconds: 600 }, now, 0)).toBe('You asked for a lot in a short time. Try again at 22:40.');
    expect(refusalWords({ error: 'down', retryAfterSeconds: 60 }, now, 60)).toBe('The 3D maker is busy right now. Try again at 23:31.');
  });
  it('falls back to the server\'s own sentence when there is no wait time', () => {
    expect(refusalWords({ error: 'daily', message: 'Come back later.' }, now, 0)).toBe('Come back later.');
    expect(refusalWords({ error: 'moderation', message: 'This photo cannot be used here.' }, now, 0)).toBe('This photo cannot be used here.');
  });
  it('the 429 body has the same three fields every time, and a wait of at least one second', () => {
    expect(refusalBody('daily', 'x', 0.2)).toEqual({ error: 'daily', message: 'x', retryAfterSeconds: 1 });
    expect(Object.keys(refusalBody('busy', 'x', 30)).sort()).toEqual(['error', 'message', 'retryAfterSeconds']);
  });
  it('the page turns a 429 reply into a final error with a time to come back', () => {
    const e = submitFailure(429, refusalBody('daily', 'x', 5400), now);
    expect(e.final).toBe(true); expect(e.retryAt).toBe(now + 5_400_000); expect(e.message).toMatch(/Try again/);
    const busy = submitFailure(429, refusalBody('busy', 'x', 120), now);
    expect(busy.final).toBe(false); expect(busy.retryAt).toBe(now + 120_000);
    expect(submitFailure(503, { error: 'not allowed' }, now).message).toMatch(/not switched on/);
    expect(submitFailure(404, {}, now).message).toMatch(/preview site/); // the local dev server has no photo service: say so, not "3D service not answering"
  });
});
