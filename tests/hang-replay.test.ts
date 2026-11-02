import type { RunnerInput } from '../src/sim/runner';
import { describe, expect, it } from 'vitest';
import { barMesh, holdsOf, isHold, type P } from '../src/slice/holds-world';
import { laneToCourse, sliceProfile } from '../src/slice/slice';
import { newPiece, worldSamples } from '../src/slice/world';
import { searchIdealRun } from '../src/sim/ideal';
import { inputOfMask, maskOf, recordPlan, verifyLog } from '../src/sim/replay';
import { releaseHang, bodyVelocity } from '../src/sim/holds';
import { deck, lane } from './helpers/pieces';

// CC-44 / CC-243: grabbing a bar with E is part of the input log, so a recorded run swings and lets go the same way when the judge replays it.
const inp = (o: Partial<RunnerInput>): RunnerInput => ({ run: false, jump: false, jumpSpeed: 0, squat: false, ...o }) as RunnerInput;
const bar = (x: number, hang: number): P => ({ ...newPiece('Bar', barMesh(), { x, z: 0 }), src: 'hold:bar', y: hang - 0.04 });
const ps: P[] = [deck(0, 8), deck(17, 8), bar(8.5, 2.2)];
const course = laneToCourse(sliceProfile(worldSamples(ps.filter((p) => !isHold(p))), { x: 0, z: 0 }, lane), 'test', holdsOf(ps, lane));

describe('a bar grab in the input log', () => {
  it('the E bit survives the log', () => {
    expect(inputOfMask(maskOf(inp({ handL: true, handR: true }))).handL).toBe(true);
    expect(maskOf(inp({ handL: true }))).not.toBe(maskOf(inp({})));
  });
  it('the recorded swing run replays to the same finish, tick for tick, and the log holds E while hanging', () => {
    const plan = searchIdealRun(course).plan;
    const { recorder, world } = recordPlan(course, plan);
    expect(world.outcome).toBe('cleared');
    const log = recorder.snapshot();
    expect(log.some(([m]) => inputOfMask(m).handL || inputOfMask(m).handR)).toBe(true);
    const v = verifyLog(course, log);
    expect(v.cleared).toBe(true);
    expect(v.ticks).toBe(world.runner.tick);
    expect(v.world.runner.x).toBe(world.runner.x);
  });
  it('dropping the E presses from the log means no grab: the same log without E falls in the gap', () => {
    const { recorder } = recordPlan(course, searchIdealRun(course).plan);
    const noE = recorder.snapshot().map(([m, n]) => [m & ~((1 << 5) | (1 << 6)), n] as [number, number]);
    expect(verifyLog(course, noE).cleared).toBe(false);
  });
  it('letting go carries the velocity of the swing (the body keeps its place and flies on with omega times the release radius)', () => {
    const h = course.holds![0], s = { hold: 0, theta: 0.6, omega: 2.5 };
    const rel = releaseHang(h, s), v = bodyVelocity(s);
    expect(rel.vx).toBeCloseTo(v.vx, 9);
    expect(rel.vy).toBeCloseTo(v.vy, 9);
    expect(Math.hypot(rel.vx, rel.vy)).toBeGreaterThan(0);
  });
});
