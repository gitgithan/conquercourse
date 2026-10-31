import { describe, expect, it } from 'vitest';
import { IDLE, LANE_CAP_MS, barFraction, begin, cancel, edited, finalText, finish, isSearching, isStopped, progressText, tick, withProgress } from '../src/slice/lane-check';

// CC-243: the lane check's states, in plain words.
describe('lane check state machine', () => {
  it('starts idle, searches, and finishes with a verdict', () => {
    let s = IDLE;
    expect(isSearching(s)).toBe(false);
    s = begin(1000);
    expect(isSearching(s)).toBe(true);
    expect(finish(s, true)).toEqual({ kind: 'done', cleared: true });
    expect(finish(s, false)).toEqual({ kind: 'done', cleared: false });
  });
  it('cancel leaves the lane not checked, and a late answer cannot undo it', () => {
    const s = cancel(withProgress(begin(0), { label: 'x', step: 2, of: 10 }));
    expect(s.kind).toBe('cancelled');
    expect(isStopped(s)).toBe(true);
    expect(finish(s, true)).toBe(s);
    expect(finalText(s)!.word).toBe('Stopped');
    expect(finalText(s)!.line).toMatch(/not checked/);
  });
  it('cancel does nothing when no search is running', () => {
    expect(cancel(IDLE)).toBe(IDLE);
    const d = finish(begin(0), true);
    expect(cancel(d)).toBe(d);
  });
  it('the hard cap turns a long search into Timed out, and not before', () => {
    const s = begin(5000);
    expect(tick(s, 5000 + LANE_CAP_MS - 1)).toBe(s);
    const t = tick(s, 5000 + LANE_CAP_MS);
    expect(t.kind).toBe('timeout');
    expect(finish(t, true)).toBe(t);
    expect(finalText(t)!.word).toBe('Timed out');
    expect(finalText(t)!.line).toMatch(/3 minutes/);
  });
  it('an edit throws the old state away', () => {
    expect(edited()).toEqual(IDLE);
  });
  it('progress is only kept while searching', () => {
    const p = { label: 'lane', step: 3, of: 12 };
    expect(withProgress(IDLE, p)).toBe(IDLE);
    const done = finish(begin(0), false);
    expect(withProgress(done, p)).toBe(done);
  });
  it('the progress line says step, total and seconds in plain words', () => {
    let s = begin(0);
    expect(progressText(s, 4200)).toBe('Searching for a way through: 4 seconds so far');
    s = withProgress(s, { label: 'a', step: 3, of: 12 });
    expect(progressText(s, 1000)).toBe('Searching for a way through: step 3 of 12, 1 second so far');
    expect(progressText(IDLE, 1000)).toBe('');
  });
  it('the bar is determinate only when the search reports a measure', () => {
    expect(barFraction(begin(0))).toBeNull();
    expect(barFraction(withProgress(begin(0), { label: 'a', step: 3, of: 12 }))).toBe(0.25);
    expect(barFraction(withProgress(begin(0), { label: 'a', step: 20, of: 12 }))).toBe(1);
    expect(barFraction(IDLE)).toBeNull();
  });
  it('the four final states are named', () => {
    expect(finalText(finish(begin(0), true))!.word).toBe('Clears');
    expect(finalText(finish(begin(0), false))!.word).toBe("Can't clear");
    expect(finalText(IDLE)).toBeNull();
    expect(finalText(begin(0))).toBeNull();
  });
});
