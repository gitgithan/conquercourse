import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The form is data (public/feedback-questions.json). The database stores answers as JSON text keyed by question id (functions/api/submit.ts),
// so any question set that follows these rules fits the existing schema with no migration.
interface Q { id: string; type: string; text: string; options?: string[]; about?: string; href?: string; section?: string; when?: { id: string; values: string[] } }
const round = JSON.parse(readFileSync('public/feedback-questions.json', 'utf8')) as { round: string; title: string; intro: string; questions: Q[] };
const submit = readFileSync('functions/api/submit.ts', 'utf8');
const widget = readFileSync('src/ui/feedback.ts', 'utf8');
const byId = new Map(round.questions.map((q) => [q.id, q]));

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
      expect(['scale', 'choice', 'multi', 'text', 'seen']).toContain(q.type);
      if (q.type === 'choice' || q.type === 'multi' || q.type === 'seen') expect((q.options ?? []).length).toBeGreaterThan(1);
      if (q.when) {
        const gate = byId.get(q.when.id);
        expect(gate, q.id).toBeDefined();
        for (const v of q.when.values) expect(gate!.options ?? []).toContain(v);
      }
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
    expect(open.some((t) => /where was it|where were you|point to/.test(t))).toBe(true);
    expect(open.some((t) => /wish|more|bring/.test(t))).toBe(true);
  });
  it('has a round name the summary script can use', () => {
    expect(round.round).toMatch(/^[a-z0-9-]{1,40}$/);
  });
  it('layer 1: every feature is on the map, with a line about it and a working link', () => {
    const seen = round.questions.filter((q) => q.type === 'seen');
    const ids = seen.map((q) => q.id);
    for (const id of ['seen_courses', 'seen_dojo', 'seen_ghost', 'seen_slicer', 'seen_editor', 'seen_photo', 'seen_community_play', 'seen_community_share', 'seen_coaster', 'seen_random', 'seen_labs']) expect(ids, id).toContain(id);
    for (const q of seen) {
      expect(q.options).toEqual(['Tried it', 'Saw it, did not try', 'Never saw this']);
      expect((q.about ?? '').length, q.id).toBeGreaterThan(10);
      expect(q.href, q.id).toMatch(/^(\?|\?mode=(dojo|map|editor|park|gallery|coaster|lab-search)|\?generate=\d+)/);
    }
    expect(byId.get('seen_slicer')!.text).toBe('World Slicer');
    expect(byId.get('seen_editor')!.text).toBe('World Editor');
  });
  it('layer 2: World Slicer, World Editor, Courses and Community are asked about by name', () => {
    for (const f of ['slicer', 'editor', 'courses', 'community']) {
      expect(byId.get(`${f}_feel`)?.type, f).toBe('scale');
      expect(byId.get(`${f}_text`)?.type, f).toBe('text');
      expect(byId.get(`${f}_why`)?.type, f).toBe('choice');
      expect(byId.get(`${f}_feel`)?.when?.values).toEqual(['Tried it']);
      expect(byId.get(`${f}_why`)?.when?.values).toEqual(['Saw it, did not try', 'Never saw this']);
    }
    const asked = round.questions.map((q) => q.text).join('\n');
    for (const name of ['World Slicer', 'World Editor', 'Courses', 'Community']) expect(asked).toContain(name);
  });
  it('says at the top that every field is optional and sending always works', () => {
    expect(widget).toContain('Every field is optional. You can press Send at any time');
    expect(widget).not.toContain('Answer any one question, then press Send');
    expect(widget).toContain('Send now');
  });
  it('uses the current feature names, not the old ones', () => {
    const form = JSON.stringify(round);
    for (const old of ['Slice a real place', 'Build your own (editor)', 'Course editor', 'World explorer']) expect(form).not.toContain(old);
  });
  it('really hides a gated question (an inline display style would beat the hidden attribute)', () => {
    expect(widget).toContain("box.style.display = show ? 'grid' : 'none'");
  });
});
