import { describe, expect, it } from 'vitest';
import { playPlan } from '../src/sim/ideal';
import { routeCourse } from '../src/sim/branches';
import { proveEditorCourse } from '../src/sim/fork';
import { polePiece, polesOf, poleSrc, poleTopOf } from '../src/slice/pole-world';
import { piecesFromSource } from '../src/slice/roundtrip';
import { presetKey, storedPlanFor } from '../src/slice/preset-plans';
import { PRESETS } from '../src/slice/presets';
import { presetCourse } from '../scripts/preset-courses';

// CC-133: the editor's pole piece and the proof of the bulb lane (the pole and the bars) next to the bench lane.
const fork = PRESETS.find((p) => p.id === 'fork')!;

describe('the editor pole piece', () => {
  it('keeps its height in its source and survives a save and open', () => {
    expect(poleTopOf(poleSrc(3.7))).toBe(3.7);
    expect(poleTopOf('pole:99')).toBe(5);
    const [q] = piecesFromSource([{ src: poleSrc(4.3), x: 10, z: 0, y: 0, yaw: 0, scale: 1 }]);
    expect(q.src).toBe('pole:4.3');
    expect(polesOf([polePiece(4.3, { x: 10, z: 0 })], { angle: 0, offset: 0, level: 0 })).toEqual([{ u: 10, top: 4.3 }]);
  });
  it('the preset becomes a course with a pole that hands over to the first bar, and a fork', () => {
    const c = presetCourse(fork);
    expect(c.climbPoles).toHaveLength(1);
    expect(c.holds!.length).toBe(8);
    expect(c.climbPoles![0].toHold).toBe(0);
    expect(c.climbPoles![0].top).toBe(c.holds![0].y);
    expect(c.branches![0].routes.map((r) => r.id)).toEqual(['bench', 'bulb']);
  });
  it('the proof clears BOTH lanes, each line clears with the other lane closed, and the stored proof is the one the editor shows', () => {
    const c = presetCourse(fork);
    const r = proveEditorCourse(c);
    expect(r.cleared).toBe(true);
    for (const lane of r.branches![0].routes) {
      expect(lane.plan, lane.id).toBeDefined();
      const sub = playPlan(routeCourse({ ...c, branches: r.branches }, 'fork', lane.id), lane.plan!);
      expect(sub.world.outcome, lane.id).toBe('cleared');
      expect(sub.world.runner.tick, lane.id).toBe(lane.ticks);
    }
    const stored = storedPlanFor(c);
    expect(stored?.cleared).toBe(true);
    expect(stored?.key).toBe(presetKey(c));
    expect(stored?.branches?.[0].routes.every((l) => l.plan)).toBe(true);
  });
  it('a pole with no way up (the top has no bar after it) adds a pole to the course but no fork', () => {
    const c = presetCourse({ ...fork, pieces: fork.pieces.filter((q) => !q.src.startsWith('hold:')) });
    expect(c.branches).toBeUndefined();
    expect(c.climbPoles).toBeUndefined();
  });
}, 120000);
