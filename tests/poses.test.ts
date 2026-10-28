import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three/webgpu';
import { HURT_FALL_S, HURT_RISE_S, HURT_STAY_S, HURT_TICKS, SEAT_HIPS, giantSwingLegs, hurtPhase, seatThighPitch, type LegIndex } from '../src/motion/poses';
import { chooseClip, type ActorState } from '../src/motion/actor-pose';
import { MOTION_TABLE, motionGaps } from '../src/motion/motion-table';
import { actorStateFor } from '../src/motion/actor-state';
import { newWorld } from '../src/sim/world';
import type { CourseData } from '../src/course/course';

// joints: 0 hips, then per side hip, knee, foot, toe (a body hanging straight down, legs 0.45 m thigh and 0.42 m shin)
const hang = (): { joints: Vector3[]; legs: LegIndex[] } => {
  const joints = [new Vector3(0, 1.0, 0)];
  const legs: LegIndex[] = [];
  for (const z of [-0.1, 0.1]) {
    const base = joints.length;
    joints.push(new Vector3(0, 1.0, z), new Vector3(0.02, 0.55, z), new Vector3(0, 0.13, z), new Vector3(0.11, 0.09, z));
    legs.push({ hip: base, knee: base + 1, foot: base + 2, toe: base + 3 });
  }
  return { joints, legs };
};
const lengths = (j: Vector3[], l: LegIndex) => [j[l.knee].distanceTo(j[l.hip]), j[l.foot].distanceTo(j[l.knee])];

describe('seated rider', () => {
  it('the feet land on the floor when the hips sit on the seat', () => {
    for (const [thigh, shin] of [[0.43, 0.42], [0.5, 0.48], [0.38, 0.36]]) {
      const a = seatThighPitch(thigh, shin, SEAT_HIPS);
      const footY = SEAT_HIPS + thigh * Math.sin(a) - shin * Math.cos(0.05);
      expect(Math.abs(footY)).toBeLessThan(1e-9);
    }
  });
  it('the thigh is close to horizontal (a sitting person, not a squat)', () => {
    const a = seatThighPitch(0.43, 0.42, SEAT_HIPS);
    expect(Math.abs(a)).toBeLessThan(0.4);
  });
});

describe('hurt landing', () => {
  it('crumples, stays down, then gets up slowly, in that order', () => {
    expect(hurtPhase(0).phase).toBe('fall');
    expect(hurtPhase(Math.round((HURT_FALL_S + 0.1) * 120)).phase).toBe('down');
    expect(hurtPhase(Math.round((HURT_FALL_S + HURT_STAY_S + 0.1) * 120)).phase).toBe('rise');
    expect(hurtPhase(HURT_TICKS * 2)).toEqual({ phase: 'rise', t: 1 });
  });
  it('getting up takes longer than falling', () => {
    expect(HURT_RISE_S).toBeGreaterThan(HURT_FALL_S * 2);
  });
  it('the table gives it a duration and a pose, and no move is left without a motion', () => {
    expect(MOTION_TABLE.hurt.ticks).toBe(HURT_TICKS);
    expect(motionGaps()).toEqual(expect.not.arrayContaining(['hurt', 'seated', 'launch', 'giant-swing']));
  });
});

describe('giant swing legs', () => {
  it('a hanging body at rest keeps straight legs', () => {
    const { joints, legs } = hang();
    const before = joints.map((p) => p.clone());
    giantSwingLegs(joints, legs, 0, 0, 0);
    legs.forEach((l) => { expect(joints[l.knee].y).toBeCloseTo(before[l.knee].y, 1); expect(Math.abs(joints[l.foot].x)).toBeLessThan(0.05); });
  });
  it('the legs trail behind a swing going forward, and lead a swing going back', () => {
    const f = hang(), b = hang();
    giantSwingLegs(f.joints, f.legs, 0, 0, 3);
    giantSwingLegs(b.joints, b.legs, 0, 0, -3);
    expect(f.joints[f.legs[0].foot].x).toBeLessThan(0);
    expect(b.joints[b.legs[0].foot].x).toBeGreaterThan(0);
  });
  it('over the top the legs tuck: the feet come up toward the hips', () => {
    const down = hang(), top = hang();
    giantSwingLegs(down.joints, down.legs, 0, 0, 0);
    giantSwingLegs(top.joints, top.legs, 0, Math.PI, 0);
    const reach = (j: Vector3[], l: LegIndex) => j[l.foot].distanceTo(j[0]);
    expect(reach(top.joints, top.legs[0])).toBeLessThan(0.75 * reach(down.joints, down.legs[0]));
  });
  it('the bones keep their lengths whatever the swing does', () => {
    for (const [theta, omega] of [[0, 0], [1.2, 3], [2.4, -2], [Math.PI, 4], [-2.8, 1]]) {
      const { joints, legs } = hang();
      const before = legs.map((l) => lengths(joints, l));
      giantSwingLegs(joints, legs, 0, theta, omega);
      legs.forEach((l, i) => lengths(joints, l).forEach((v, k) => expect(v).toBeCloseTo(before[i][k], 6)));
    }
  });
});

describe('which pose the simulator state asks for', () => {
  const base: ActorState = { tick: 1000, x: 10, y: 0, vx: 5, vy: 0, grounded: true, mode: 'run', squat: false, landedTicksAgo: null, facing: 1 };
  it('a hard landing wins over everything else', () => {
    expect(chooseClip({ ...base, hurt: true, grounded: false })).toBe('hurt');
    expect(chooseClip({ ...base, hurt: true, mode: 'swing' })).toBe('hurt');
  });
  it('the sling holds the rider, the cart seats the rider', () => {
    expect(chooseClip({ ...base, mode: 'launch' })).toBe('sling');
    expect(chooseClip({ ...base, mode: 'cart' })).toBe('sit');
  });
});


describe('the simulator state reaches the actor', () => {
  const course = { version: 1, name: '', startX: 0, finishX: 50, jumpSpeed: 4.5, terrain: { waterY: -1.5, platforms: [{ id: 'a', x0: -10, x1: 60, top: 0 }] }, holds: [{ x: 5, y: 3 }] } as unknown as CourseData;
  it('a hard landing sets hurt on the actor and the running pose is not asked for', () => {
    const w = { ...newWorld(course), outcome: 'hurt' as const };
    const s = actorStateFor(w, false);
    expect(s.hurt).toBe(true);
    expect(chooseClip(s)).toBe('hurt');
  });
  it('a bar swing carries omega, so the legs can lag and tuck', () => {
    const w = { ...newWorld(course), mode: 'hang' as const, hang: { hold: 0, theta: 2.5, omega: -3.2 } };
    const s = actorStateFor(w, false);
    expect(s.swingOmega).toBe(-3.2);
    expect(s.swingTheta).toBe(2.5);
    expect(chooseClip(s)).toBe('swing');
  });
  it('the sling keeps its own mode instead of the running pose', () => {
    const w = { ...newWorld(course), mode: 'launch' as const };
    expect(actorStateFor(w, false).mode).toBe('launch');
  });
});
