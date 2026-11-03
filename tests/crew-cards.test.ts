import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { crewCards } from '../src/characters/crew-cards';
import { crewCardsOn } from '../src/ui/crew-dialog';
import { VOICES } from '../src/ui/says';

const items = (JSON.parse(readFileSync('public/assets/characters/cast/index.json', 'utf8')) as { items: { id: string; name: string; prompt: string; thumb: string }[] }).items;

describe('Meet the crew cards', () => {
  const cards = crewCards(items);
  it('has ten cards: the eight cast then Pip and Juno, each with a name', () => {
    expect(cards).toHaveLength(10);
    expect(cards.map((c) => c.name)).toEqual([...items.map((i) => i.name), VOICES.pip.name, VOICES.juno.name]);
    expect(new Set(cards.map((c) => c.key)).size).toBe(10);
    for (const c of cards) expect(c.name.length, c.key).toBeGreaterThan(1);
  });
  it('gives each cast card a picture and a model, and the Rookies neither', () => {
    for (const c of cards.slice(0, 8)) { expect(c.thumb).toMatch(/\.webp$/); expect(c.model).toMatch(/\.glb$/); }
    expect(cards.slice(8).map((c) => c.rookie)).toEqual(['a', 'b']);
  });
  it('is on unless the address says crewcards=old', () => {
    expect(crewCardsOn(null)).toBe(true);
    expect(crewCardsOn('old')).toBe(false);
  });
  it('the dialog has a Make a character button and builds no "says" pills', () => {
    const src = readFileSync('src/ui/crew-dialog.ts', 'utf8');
    expect(src).toContain("'Make a character'");
    expect(src).toContain('openCharacterPanel');
    expect(src).not.toMatch(/meetTheCrew|sayBadge|crewLegend/);
  });
});
