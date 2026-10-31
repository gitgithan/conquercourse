// CC-108: every reason the server gives for turning a run down has its own plain sentence.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { publishErrorText } from '../src/ui/feedback';

describe('publish error messages', () => {
  const cases: [number, string, string | undefined, RegExp][] = [
    [429, 'slow-down', undefined, /Slow down/],
    [409, 'course-changed', undefined, /course changed/],
    [404, 'no-course', undefined, /listed courses/],
    [422, 'not-a-clear', undefined, /finish/],
    [422, 'not-possible', 'too-long', /too long/],
    [422, 'not-possible', 'too-fast', /not possible/],
    [422, 'not-possible', 'key-rate', /keys/],
    [400, 'bad-run', undefined, /Play it again/],
    [413, 'body-too-big', undefined, /too long/],
    [503, 'not-ready', undefined, /not ready/],
  ];
  for (const [status, reason, code, re] of cases) it(`${reason}${code ? ` (${code})` : ''} says something specific`, () => { expect(publishErrorText(status, reason, code)).toMatch(re); });
  it('falls back on the status when the server sent no reason', () => {
    expect(publishErrorText(429)).toMatch(/Slow down/);
    expect(publishErrorText(409)).toMatch(/changed/);
    expect(publishErrorText(500)).not.toMatch(/did not accept/);
  });
  it('every error the server returns carries a reason the client knows', () => {
    const src = readFileSync('functions/api/course-clear.ts', 'utf8');
    const errors = [...src.matchAll(/json\(\{ error: '[^']+'(.*?)\}, \d+\)/g)];
    expect(errors.length).toBeGreaterThan(8);
    for (const m of errors) {
      const r = /reason: '([a-z-]+)'/.exec(m[0]);
      expect(r, m[0]).not.toBeNull();
      expect(publishErrorText(400, r![1], 'x'), r![1]).not.toMatch(/could not take this run/);
    }
  });
});
