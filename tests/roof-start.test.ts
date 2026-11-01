import { afterEach, describe, expect, it } from 'vitest';
import { laneToCourse, setRoofStart, sliceProfile } from '../src/slice/slice';
import { searchIdealRun } from '../src/sim/ideal';

// Owner 2026-11-01: with the roof start, a lane that begins on a roof 12 m up can still be run, because the start deck stands at that roof.
const cells = (...runs: [number, number][]) => runs.flatMap(([n, h]) => Array.from({ length: n }, () => h));
describe('roof start', () => {
  afterEach(() => setRoofStart(false));
  it('starts the course at the first roof, not at the cut height', () => {
    const cs = [...cells([30, 12]), ...Array(20).fill(null), ...cells([30, 12.4])];
    const profile = { cells: cs as (number | null)[], length: cs.length * 0.1, origin: 0 };
    setRoofStart(false);
    const off = laneToCourse({ ...profile, cells: [...cs] });
    setRoofStart(true);
    const on = laneToCourse({ ...profile, cells: [...cs] });
    expect(off.terrain.platforms[1].top).toBeGreaterThan(11);
    expect(on.terrain.platforms[1].top).toBe(0);
    expect(searchIdealRun(on).cleared).toBe(true);
    expect(searchIdealRun(off).cleared).toBe(false);
  });
  it('hides what lies below the cut', () => {
    const s = new Float32Array([0, -0.5, 0, 0.3, -2, 0, 0.6, 1, 0]); // y = -0.5, -2 (below the cut), 1
    setRoofStart(true);
    const p = sliceProfile(s, { x: 0, z: 0 }, { angle: 0, offset: 0, level: 0 });
    expect(p.cells.filter((v) => v !== null)).toEqual([1]);
    setRoofStart(false);
    expect(sliceProfile(s, { x: 0, z: 0 }, { angle: 0, offset: 0, level: 0 }).cells.filter((v) => v !== null).length).toBe(3);
  });
});
