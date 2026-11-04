import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { crewCards } from '../src/characters/crew-cards';
import { crewCardsOn } from '../src/ui/crew-dialog';
import { SUPPORTING, VOICES } from '../src/ui/says';

const items = (JSON.parse(readFileSync('public/assets/characters/cast/index.json', 'utf8')) as { items: { id: string; name: string; prompt: string; thumb: string }[] }).items;

describe('Meet the crew cards', () => {
  const cards = crewCards(items);
  it('has ten cards: the eight cast then Pip and Juno, each with a name', () => {
    expect(cards).toHaveLength(10);
    expect(cards.map((c) => c.name)).toEqual([...items.map((i) => i.name), VOICES.pip.name, VOICES.juno.name]);
    expect(new Set(cards.map((c) => c.key)).size).toBe(10);
    for (const c of cards) expect(c.name.length, c.key).toBeGreaterThan(1);
  });
  it('gives every card a picture, each cast card a model, and Pip and Juno a T-pose picture too', () => {
    for (const c of cards) expect(c.thumb).toMatch(/\.webp$/);
    for (const c of cards.slice(0, 8)) expect(c.model).toMatch(/\.glb$/);
    expect(cards.slice(8).map((c) => [c.rookie, c.thumb?.split('/').pop()])).toEqual([['a', 'pip.webp'], ['b', 'juno.webp']]);
    for (const f of ['pip', 'juno']) expect(existsSync(`public/assets/characters/cast/${f}.webp`), f).toBe(true);
  });
  it('is on unless the address says crewcards=old', () => {
    expect(crewCardsOn(null)).toBe(true);
    expect(crewCardsOn('old')).toBe(false);
  });
  it('the dialog has a Make a character button, a Main and a Supporting section, and Pip and Juno are not supporting', () => {
    const src = readFileSync('src/ui/crew-dialog.ts', 'utf8');
    expect(src).toContain("'Make a character'");
    expect(src).toContain('openCharacterPanel');
    expect(src).toContain('Main Characters');
    expect(src).toContain('Supporting Characters');
    expect(SUPPORTING).not.toContain('pip');
    expect(SUPPORTING).not.toContain('juno');
  });
});
