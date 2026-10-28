import { describe, expect, it } from 'vitest';
import { CLIMBABLE, type Profile } from '../src/slice/slice';
import { BAND_GAP_M, JUMP_GAP_M, laneFacts, looksCrossable, whyNot } from '../src/slice/why';

// a lane from stretches: [metres, height] with null for a hole (cells are 0.1 m)
const lane = (...parts: [number, number | null][]): Profile => {
  const cells: (number | null)[] = [];
  for (const [m, h] of parts) for (let i = 0; i < Math.round(m * 10); i++) cells.push(h);
  return { cells, length: cells.length / 10, origin: 0 };
};

describe('why a lane cannot be cleared (CC-92)', () => {
  it('measures the widest gap, the tallest step and the fall', () => {
    const f = laneFacts(lane([6, 0], [3, null], [6, 0.5], [2, 3], [4, 0]));
    expect(f.widestGapM).toBeCloseTo(3, 1);
    expect(f.tallestStepM).toBeCloseTo(2.5, 1);
    expect(f.deepestDropM).toBeCloseTo(3, 1);
    expect(f.solidShare).toBeGreaterThan(0.8);
    expect(f.solidShare).toBeLessThan(0.9);
  });

  it('a short crack is not a gap and a lane of flat ground has nothing in the way', () => {
    const f = laneFacts(lane([8, 0], [0.5, null], [8, 0]));
    expect(f.widestGapM).toBe(0);
    expect(looksCrossable(f)).toBe(true);
    expect(whyNot(f).blocked).toBe('none');
  });

  it('says a gap is wider than a run and jump, and what could cross it', () => {
    const wide = whyNot(laneFacts(lane([8, 0], [11, null], [8, 0])));
    expect(wide.blocked).toBe('gap');
    expect(wide.lines.join(' ')).toMatch(/widest gap is 11 m/);
    expect(wide.lines.join(' ')).toMatch(new RegExp(`about ${JUMP_GAP_M} m`));
    expect(wide.lines.join(' ')).toMatch(/band/);
    const huge = whyNot(laneFacts(lane([8, 0], [BAND_GAP_M + 6, null], [8, 0])));
    expect(huge.lines.join(' ')).toMatch(/cannon or a drone/);
  });

  it('a narrow gap with a higher far side names the jump, not the widest gap', () => {
    const f = laneFacts(lane([8, 0], [6, null], [8, 2.2]));
    expect(f.widestGapM).toBeCloseTo(6, 1);
    expect(f.hardGapM).toBeGreaterThan(4);
    expect(f.hardRiseM).toBeGreaterThan(1.5);
    if (f.needsSpeed > 8.5) expect(whyNot(f).lines.join(' ')).toMatch(/hardest jump is a gap of [0-9.]+ m with the far side [0-9.]+ m higher/);
  });

  it('says a wall is taller than a climb', () => {
    const f = laneFacts(lane([6, 0], [6, CLIMBABLE + 1.2]));
    const w = whyNot(f);
    expect(w.blocked).toBe('wall');
    expect(w.lines[0]).toMatch(/wall on this lane is 4 m tall/);
    expect(looksCrossable(f)).toBe(false);
  });

  it('says a fall is longer than a roll survives', () => {
    const w = whyNot(laneFacts(lane([6, 14], [6, 0])));
    expect(w.blocked).toBe('drop');
    expect(w.lines[0]).toMatch(/A fall on this lane is 14 m/);
  });

  it('says a lane is too short to run along', () => {
    expect(whyNot(laneFacts(lane([5, 0]))).blocked).toBe('short');
  });
});
