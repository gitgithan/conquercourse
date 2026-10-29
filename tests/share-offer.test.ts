import { describe, expect, it } from 'vitest';
import { challengeWords, offersIdeal } from '../src/share/challenge';

describe('the offer beside a refused challenge link (CC-135)', () => {
  it('offers the ideal ghost when the course changed, the build is older or the keys do not clear', () => {
    for (const why of ['changed', 'version', 'not-cleared'] as const) expect(offersIdeal(why), why).toBe(true);
  });
  it('offers nothing for a damaged link', () => {
    expect(offersIdeal('broken')).toBe(false);
  });
  it('the message still says what went wrong', () => {
    expect(challengeWords('changed')).toMatch(/changed/);
  });
});
