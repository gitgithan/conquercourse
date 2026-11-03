import { describe, expect, it } from 'vitest';
import { createEta, etaText } from '../src/modes/course/search-eta';

// Play a run: durations[i] is how long step i+1 takes (ms); notes arrive at the start of each step, plus a note every 500 ms inside it.
function play(durations: number[]) {
  const eta = createEta(); const out: { t: number; v: ReturnType<typeof eta.note> }[] = []; let t = 0;
  durations.forEach((d, i) => { for (let k = 0; k < d; k += 500) { out.push({ t: t + k, v: eta.note(i + 1, durations.length, t + k) }); } t += d; });
  return { out, total: t };
}

describe('search time left', () => {
  it('says "a few seconds" with no number while nothing has finished', () => {
    const eta = createEta();
    const v = eta.note(1, 8, 0);
    expect(v.seconds).toBeNull(); expect(v.text).toBe('a few seconds left'); expect(v.fraction).toBeLessThan(0.05);
    expect(eta.note(1, 8, 2000).seconds).toBeNull();
  });
  it('a single long step keeps the bar creeping and says "a little longer" after 10 s', () => {
    const eta = createEta(); const a = eta.note(1, 1, 0), b = eta.note(1, 1, 8000), c = eta.note(1, 1, 16000);
    expect(b.fraction).toBeGreaterThan(a.fraction); expect(c.fraction).toBeGreaterThan(b.fraction); expect(c.fraction).toBeLessThan(0.9);
    expect(a.text).toBe('a few seconds left'); expect(c.text).toBe('a little longer');
  });
  it('is never negative and the bar only moves forward', () => {
    const { out } = play([1000, 6000, 800, 15000, 500, 500, 9000, 1000]);
    let fr = 0;
    for (const { v } of out) { if (v.seconds !== null) expect(v.seconds).toBeGreaterThanOrEqual(0); expect(v.fraction).toBeGreaterThanOrEqual(fr); fr = v.fraction; }
  });
  it('even steps: the time left falls as the run goes on and ends near zero', () => {
    const { out } = play(Array(10).fill(3000));
    const nums = out.map((o) => o.v.seconds).filter((s): s is number => s !== null);
    expect(nums.length).toBeGreaterThan(5);
    for (let i = 1; i < nums.length; i++) expect(nums[i]).toBeLessThanOrEqual(nums[i - 1] + 0.01);
    expect(nums[nums.length - 1]).toBeLessThan(4);
  });
  it('even steps: a middle guess is close to the truth (within 25 %)', () => {
    const { out, total } = play(Array(10).fill(3000));
    const mid = out.find((o) => o.t >= 15000)!;
    expect(Math.abs(mid.v.seconds! * 1000 - (total - mid.t))).toBeLessThan((total - mid.t) * 0.25 + 1500);
  });
  it('uneven steps: one slow step does not make the number jump (at most 3 s up, 4 s down per second)', () => {
    const { out } = play([1500, 1500, 1500, 18000, 1500, 1500, 1500, 1500]);
    const nums = out.map((o) => o.v.seconds).filter((s): s is number => s !== null);
    for (let i = 1; i < nums.length; i++) expect(nums[i] - nums[i - 1]).toBeLessThanOrEqual(1.5 + 0.01), expect(nums[i - 1] - nums[i]).toBeLessThanOrEqual(2 + 0.01); // notes 0.5 s apart
  });
  it('a step that runs far past its guess still leaves a little time, never below zero', () => {
    const eta = createEta(); eta.note(1, 3, 0); eta.note(2, 3, 3000);
    const v = eta.note(2, 3, 60000);
    expect(v.seconds).toBeGreaterThan(0);
  });
  it('says plain rounded words', () => {
    expect(etaText(null)).toBe('a few seconds left');
    expect(etaText(3)).toBe('a few seconds left');
    expect(etaText(12.4)).toBe('about 10 s left');
    expect(etaText(31)).toBe('about 30 s left');
    expect(etaText(59)).toBe('about 60 s left');
    expect(etaText(61)).toBe('more than a minute left');
  });
});
