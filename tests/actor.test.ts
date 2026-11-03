import { describe, expect, it } from 'vitest';
import { sampleClip } from '../src/motion/clip';
import {
  advanceDistance, chooseClip, crouchDepth, facingYaw, flightProgress, leapSeconds, localAngle, reachSeconds, runSeconds, runWeight,
  LAND_TICKS, type ActorState,
} from '../src/motion/actor-pose';
import { loadClip } from './helpers/clips';

const load = loadClip;
const run = load('run');
const leap = load('leap');
const reach = load('reach');

const base: ActorState = { tick: 1000, x: 10, y: 0, vx: 5, vy: 0, grounded: true, mode: 'run', squat: false, landedTicksAgo: null, facing: 1 };
const at = (o: Partial<ActorState>): ActorState => ({ ...base, ...o });

describe('clip choice by state', () => {
  it('stands when still and runs when moving', () => {
    expect(chooseClip(at({ vx: 0 }))).toBe('stand');
    expect(chooseClip(at({ vx: -4, facing: -1 }))).toBe('run');
  });
  it('leaps while airborne in run mode, lands for a moment after touch-down', () => {
    expect(chooseClip(at({ grounded: false, vy: 3 }))).toBe('leap');
    expect(chooseClip(at({ landedTicksAgo: 5 }))).toBe('land');
    expect(chooseClip(at({ landedTicksAgo: LAND_TICKS }))).toBe('run');
  });
  it('follows the obstacle mode: swing, bounce, wall run then reach over the last quarter', () => {
    expect(chooseClip(at({ mode: 'swing', grounded: false }))).toBe('swing');
    expect(chooseClip(at({ mode: 'bounce' }))).toBe('bounce');
    expect(chooseClip(at({ mode: 'wall', wallProgress: 0.5 }))).toBe('wall-run');
    expect(chooseClip(at({ mode: 'wall', wallProgress: 0.75 }))).toBe('wall-reach');
    expect(chooseClip(at({ mode: 'wall', wallProgress: 1 }))).toBe('wall-reach');
  });
});

describe('time-warp by speed', () => {
  it('blends from the stand pose to the run with speed, never leaving 0..1', () => {
    expect(runWeight(0)).toBe(0);
    expect(runWeight(4)).toBe(1);
    expect(runWeight(-4)).toBe(1);
    expect(runWeight(0.5)).toBeGreaterThan(0);
    expect(runWeight(0.5)).toBeLessThan(1);
  });
  it('looks the run pose up by distance, so faster feet-planted running plays the clip faster and the loop has no pop', () => {
    const lap = run.frames[run.frames.length - 1][0][2] - run.frames[0][0][2];
    expect(runSeconds(run, 0, 1)).toBeCloseTo(0, 9);
    // one lap of distance is one clip duration, whatever speed the Rookie covered it at
    expect(runSeconds(run, lap, 1)).toBeCloseTo((run.frames.length - 1) / run.fps, 6);
    expect(runSeconds(run, 2 * lap, 1)).toBeCloseTo(2 * runSeconds(run, lap, 1), 6);
    // scaled bodies cover the same clip distance in proportionally less ground
    expect(runSeconds(run, lap * 0.9, 0.9)).toBeCloseTo(runSeconds(run, lap, 1), 6);
    // the pose after one lap equals the pose at the start
    const a = sampleClip(run, runSeconds(run, 0, 1), true);
    const b = sampleClip(run, runSeconds(run, lap, 1), true);
    a.forEach((p, i) => p.forEach((v, k) => expect(b[i][k]).toBeCloseTo(v, 6)));
  });
  it('maps flight progress from vertical speed (0 at take-off, 1 at touch-down) and the leap clip from take-off to landing frame', () => {
    expect(flightProgress(4, 4)).toBe(0);
    expect(flightProgress(4, 0)).toBeCloseTo(0.5, 9);
    expect(flightProgress(4, -4)).toBe(1);
    expect(flightProgress(4, -9)).toBe(1);
    expect(leapSeconds(leap, 0)).toBeCloseTo(leap.takeoff! / leap.fps, 9);
    expect(leapSeconds(leap, 1)).toBeCloseTo(leap.landing! / leap.fps, 9);
  });
  it('plays the reach clip only over the last quarter of the wall', () => {
    expect(reachSeconds(reach, 0.75)).toBe(0);
    expect(reachSeconds(reach, 1)).toBeCloseTo((reach.frames.length - 1) / reach.fps, 9);
  });
  it('crouches deeper when squatting, and settles back', () => {
    expect(crouchDepth(true, 30)).toBeGreaterThan(crouchDepth(false, 30));
    expect(crouchDepth(true, 0)).toBeCloseTo(0, 9);
    expect(crouchDepth(true, LAND_TICKS)).toBeCloseTo(0, 9);
  });
  it('keeps counting distance through a teleport without a pop', () => {
    expect(advanceDistance(10, { x: 10, y: 0 }, at({ x: 10.04 }))).toBeCloseTo(10.04, 9);
    expect(advanceDistance(10, { x: 10, y: 0 }, at({ x: 50 }))).toBe(10);
    expect(advanceDistance(10, { x: 10, y: 0 }, at({ x: 9.96, facing: -1 }))).toBeCloseTo(10.04, 9);
    expect(advanceDistance(10, { x: 0, y: 0 }, at({ mode: 'wall', x: 0.03, y: 0.04 }))).toBeCloseTo(10.05, 9);
  });
});

describe('mirroring', () => {
  it('turns the character half a turn to run left, and flips tilt angles with it', () => {
    expect(facingYaw(1)).toBe(0);
    expect(facingYaw(-1)).toBeCloseTo(Math.PI, 9);
    expect(localAngle(0.3, 1)).toBe(0.3);
    expect(localAngle(0.3, -1)).toBe(-0.3);
  });
});
