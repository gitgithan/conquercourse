import { describe, expect, it } from 'vitest';
import { explainNoPath } from '../src/slice/suggest';

describe('why no path', () => {
  it('says to pick another place when no cut or shrink can help', () => {
    const a = explainNoPath({ facts: null, k: 0.03, cut: 5, strip: [], picked: 4, total: 4 });
    expect(a.reason).toContain('pick another place');
    expect(a.suggestions.some((s) => s.action.kind === 'cut' || s.action.kind === 'shrink')).toBe(false);
  });
  it('offers a cut that the strip says is crossable', () => {
    const a = explainNoPath({ facts: null, k: 0.2, cut: 5, strip: [{ real: 20, lane: true, crossable: true }], picked: 4, total: 4 });
    expect(a.suggestions[0].action.kind).toBe('shrink'); // 32a49dc9 (CC-90): Shrink more is the first fix when no path is found
    expect(a.suggestions.map((x) => x.action)).toContainEqual({ kind: 'cut', value: 20 });
    expect(a.reason).not.toContain('pick another place');
  });
  it('with a proven strip, a lane that only looks good is never offered as a cut (CC-202)', () => {
    const strip = [{ real: 20, lane: true, crossable: false }];
    const guessed = explainNoPath({ facts: null, k: 0.2, cut: 5, strip, picked: 4, total: 4 });
    const proven = explainNoPath({ facts: null, k: 0.2, cut: 5, strip, picked: 4, total: 4, proven: true });
    expect(guessed.suggestions.some((x) => x.action.kind === 'cut')).toBe(true);
    expect(proven.suggestions.some((x) => x.action.kind === 'cut')).toBe(false);
  });
});
