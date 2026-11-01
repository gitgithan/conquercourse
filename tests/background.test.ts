import { describe, expect, it } from 'vitest';
import { BG_KEY, BG_MAX_CHARS, backgroundOn, keepBackground, removeBackground, savedBackground } from '../src/ui/background';

const fake = () => { const m = new Map<string, string>(); return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } }; };
const JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

describe('the course background kept in this browser (CC-249)', () => {
  it('keeps a picture, gives it back, and forgets it when removed', () => {
    const s = fake();
    expect(savedBackground(s)).toBeNull();
    expect(keepBackground(JPG, s)).toBe(true);
    expect(savedBackground(s)).toBe(JPG);
    removeBackground(s);
    expect(savedBackground(s)).toBeNull();
  });
  it('refuses a picture that is too big, not a JPEG, or when the browser has no room', () => {
    const s = fake();
    expect(keepBackground(JPG + 'A'.repeat(BG_MAX_CHARS), s)).toBe(false);
    expect(keepBackground('data:image/png;base64,AAAA', s)).toBe(false);
    expect(keepBackground('http://x/y.jpg', s)).toBe(false);
    expect(keepBackground(JPG, { ...s, setItem: () => { throw new Error('quota'); } })).toBe(false);
    expect(s.m.size).toBe(0);
  });
  it('ignores a stored value that is not a picture of ours, and works with no storage at all', () => {
    const s = fake(); s.m.set(BG_KEY, 'javascript:alert(1)');
    expect(savedBackground(s)).toBeNull();
    expect(savedBackground(null)).toBeNull(); expect(keepBackground(JPG, null)).toBe(false); expect(() => removeBackground(null)).not.toThrow();
  });
  it('is on unless the address says ?background=0', () => {
    expect(backgroundOn(new URLSearchParams(''))).toBe(true);
    expect(backgroundOn(new URLSearchParams('background=0'))).toBe(false);
  });
});
