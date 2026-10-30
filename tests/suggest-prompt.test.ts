import { describe, expect, it } from 'vitest';
import { MAX_PIECES, suggestPrompt } from '../src/slice/suggest-prompt';

const many = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `piece ${i}`, x: i * 3, heightM: 0.4 + (i % 7) * 0.1 }));

describe('the design partner prompts (CC-243)', () => {
  it('names at most three pieces, however big the course', () => {
    const p = suggestPrompt(false, many(MAX_PIECES));
    expect(p.match(/piece \d+ at/g)?.length).toBe(3);
    expect(p).toContain('27 more');
    expect(p.length).toBeLessThan(600);
  });
  it('asks for a fix when it cannot clear and for more when it can', () => {
    expect(suggestPrompt(false, many(4))).toMatch(/cannot clear/);
    expect(suggestPrompt(true, many(4))).toMatch(/more fun/);
    expect(suggestPrompt(true, [])).toContain('none');
  });
});
