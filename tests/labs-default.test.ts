import { beforeEach, describe, expect, it } from 'vitest';
import { labsOn } from '../src/ui/labs';

// Labs are on by default (owner, 2026-11-01); ?labs=0 hides them and is remembered, ?labs=1 brings them back.
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
});

describe('labs switch', () => {
  it('is on with no switch at all', () => expect(labsOn('')).toBe(true));
  it('?labs=0 turns it off and the browser remembers', () => {
    expect(labsOn('?labs=0')).toBe(false);
    expect(labsOn('')).toBe(false);
  });
  it('?labs=1 turns it back on', () => {
    labsOn('?labs=0');
    expect(labsOn('?labs=1')).toBe(true);
    expect(labsOn('')).toBe(true);
  });
});
