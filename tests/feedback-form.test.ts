import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The form is data (public/feedback-questions.json). The database stores answers as JSON text keyed by question id (functions/api/submit.ts),
// so any question set that follows these rules fits the existing schema with no migration.
interface Q { id: string; type: string; text: string; options?: string[] }
const round = JSON.parse(readFileSync('public/feedback-questions.json', 'utf8')) as { round: string; title: string; intro: string; questions: Q[] };
const submit = readFileSync('functions/api/submit.ts', 'utf8');

describe('feedback form', () => {
  it('uses question ids the server accepts, once each', () => {
    const ids = round.questions.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    const rule = /\^\[a-z0-9_-\]\{1,40\}\$/;
    expect(rule.test(submit)).toBe(true);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9_-]{1,40}$/);
    expect(ids.length).toBeLessThanOrEqual(40);
  });
  it('only uses types the widget draws, with options where needed', () => {
    for (const q of round.questions) {
      expect(['scale', 'choice', 'multi', 'text']).toContain(q.type);
      if (q.type === 'choice' || q.type === 'multi') expect((q.options ?? []).length).toBeGreaterThan(1);
    }
  });
  it('keeps the longest possible submission under the server limit', () => {
    // text answers are capped at 600 characters by the widget; ticked options join into one string the server clips to 1000
    const worst = round.questions.reduce((n, q) => n + (q.type === 'multi' ? Math.min(1000, (q.options ?? []).join(', ').length) : q.type === 'text' ? 600 : 40), 0);
    expect(worst + 1500).toBeLessThan(8000); // 1500 for the envelope and context
  });
  it('asks open questions that point to experiences and ask for more', () => {
    const open = round.questions.filter((q) => q.type === 'text').map((q) => q.text.toLowerCase());
    expect(open.length).toBeGreaterThanOrEqual(2);
    expect(round.questions.length).toBeLessThanOrEqual(5); // short on purpose: more questions, fewer answers
    expect(open.some((t) => /where was it|where were you|point to/.test(t))).toBe(true);
    expect(open.some((t) => /wish|more|bring/.test(t))).toBe(true);
  });
  it('has a round name the summary script can use', () => {
    expect(round.round).toMatch(/^[a-z0-9-]{1,40}$/);
  });
});
