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
    expect(a.suggestions[0].action).toEqual({ kind: 'cut', value: 20 });
    expect(a.reason).not.toContain('pick another place');
  });
});
