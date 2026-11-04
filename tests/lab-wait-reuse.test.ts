import { describe, expect, it } from 'vitest';
import { KINDS, OUR_REUSE, activeUnits, freshReuse, leakedUnits, switchReuse } from '../src/labs/wait/reuse';

describe('course switching resource model', () => {
  it('reuses only immutable assets and the renderer, with fresh course ownership', () => {
    const start = freshReuse(), saved = JSON.stringify(start), t = switchReuse(start, OUR_REUSE);
    expect(JSON.stringify(start)).toBe(saved);
    expect(t.kept.map((r) => r.kind)).toEqual(['renderer', 'assets']);
    expect(t.made.map((r) => r.kind)).toEqual(['scene', 'controls', 'worker']);
    expect(t.retired.map((r) => r.kind)).toEqual(['scene', 'controls', 'worker']);
    expect(t.work).toBe(9); expect(activeUnits(t.after)).toBe(26); expect(leakedUnits(t.after)).toBe(0);
  });
  it('keeps resources flat across repeated clean switches, even when rebuilding everything', () => {
    for (const renderer of [false, true]) for (const assets of [false, true]) {
      let s = freshReuse();
      for (let i = 0; i < 30; i++) { s = switchReuse(s, { renderer, assets, cleanup: true }).after; expect(activeUnits(s)).toBe(26); expect(leakedUnits(s)).toBe(0); }
      expect(s.switches).toBe(30); expect(s.course).toBe(0);
    }
  });
  it('accounts for every replaced resource under every policy, without double counting retained ones', () => {
    for (const renderer of [false, true]) for (const assets of [false, true]) for (const cleanup of [false, true]) {
      let s = freshReuse();
      for (let i = 0; i < 10; i++) {
        const t = switchReuse(s, { renderer, assets, cleanup });
        const replaced = s.active.filter((r) => !t.kept.includes(r));
        expect(t.after.leaked.length - s.leaked.length).toBe(cleanup ? 0 : replaced.length);
        expect(t.after.active.map((r) => r.kind)).toEqual(KINDS);
        const all = [...t.after.active, ...t.after.leaked]; expect(new Set(all.map((r) => r.id)).size).toBe(all.length);
        expect(t.work).toBe(t.stages.reduce((n, r) => n + r.work, 0)); expect(t.work).toBeLessThanOrEqual(31);
        s = t.after;
      }
    }
  });
  it('prevents future leaks but does not pretend to repair resources abandoned earlier', () => {
    let s = freshReuse(); for (let i = 0; i < 3; i++) s = switchReuse(s, { ...OUR_REUSE, cleanup: false }).after;
    expect(leakedUnits(s)).toBe(18);
    expect(leakedUnits(switchReuse(s, OUR_REUSE).after)).toBe(18);
    expect(leakedUnits(freshReuse())).toBe(0);
  });
  it('makes the removed work visible without claiming that reuse removes all work', () => {
    const a = switchReuse(freshReuse(), { renderer: false, assets: false, cleanup: true });
    const b = switchReuse(freshReuse(), OUR_REUSE);
    expect(a.work).toBe(31); expect(b.work).toBeLessThan(a.work);
    expect(b.stages.filter((s) => s.work > 0).map((s) => s.label)).toEqual(['Fetch course', 'Close old course', 'Build scene', 'First frame']);
  });
});
