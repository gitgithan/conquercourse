import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { anticipation, getReady, ik2, ledgeReach } from '../src/motion/compose';

describe('two-bone reach', () => {
  const a = new Vector3(0, 0, 0), l1 = 0.3, l2 = 0.28;
  it('puts the hand on a reachable target and keeps both bones their length', () => {
    for (const t of [new Vector3(0.1, 0.5, 0), new Vector3(0.3, 0.2, 0), new Vector3(-0.2, 0.4, 0)]) {
      const r = ik2(a, t, l1, l2, new Vector3(-0.6, -1, 0));
      expect(r.hand.distanceTo(t)).toBeLessThan(1e-6);
      expect(a.distanceTo(r.elbow)).toBeCloseTo(l1, 6);
      expect(r.elbow.distanceTo(r.hand)).toBeCloseTo(l2, 6);
    }
  });
  it('stops at full stretch toward a target that is too far, in its direction', () => {
    const r = ik2(a, new Vector3(0, 3, 0), l1, l2, new Vector3(-1, 0, 0));
    expect(a.distanceTo(r.hand)).toBeLessThanOrEqual(l1 + l2);
    expect(r.hand.y).toBeGreaterThan(0.5);
    expect(Math.abs(r.hand.x)).toBeLessThan(1e-6);
  });
  it('bends the elbow toward the pole side', () => {
    const r = ik2(a, new Vector3(0, 0.45, 0), l1, l2, new Vector3(-1, 0, 0));
    expect(r.elbow.x).toBeLessThan(0);
  });
});

describe('the arms reach for a ledge of any height', () => {
  it('not at all while it is far, fully when it is within an arm, smoothly between', () => {
    expect(ledgeReach(3, 0.6)).toBe(0);
    expect(ledgeReach(0.6, 0.6)).toBe(1);
    const mid = ledgeReach(1.3, 0.6);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    expect(ledgeReach(1.5, 0.6)).toBeLessThan(ledgeReach(1.0, 0.6));
  });
});

describe('getting ready for the next move', () => {
  it('builds up as the move gets near', () => {
    expect(anticipation(1)).toBe(0);
    expect(anticipation(0.1)).toBe(1);
    expect(anticipation(0.3)).toBeGreaterThan(anticipation(0.4));
  });
  it('sinks the body a little and leaves the feet where they are', () => {
    const names = ['Hips', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm', 'LeftHand', 'RightHand', 'LeftHandThumbEnd', 'RightHandThumbEnd', 'LeftHandMiddleEnd', 'RightHandMiddleEnd', 'Foot'];
    const ix = (n: string) => names.indexOf(n);
    const mk = () => names.map((n) => new Vector3(0, n === 'Foot' ? 0 : n.includes('Hand') ? 0.9 : 1, 0));
    const j = mk();
    getReady(j, ix, 'gap', 1);
    expect(j[ix('Hips')].y).toBeLessThan(1);
    expect(j[ix('Foot')].y).toBe(0);
  });
  it('does nothing at zero', () => {
    const names = ['Hips', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm', 'LeftHand', 'RightHand', 'LeftHandThumbEnd', 'RightHandThumbEnd', 'LeftHandMiddleEnd', 'RightHandMiddleEnd'];
    const j = names.map(() => new Vector3(0.1, 1, 0));
    getReady(j, (n) => names.indexOf(n), 'wall', 0);
    expect(j.every((p) => p.x === 0.1 && p.y === 1)).toBe(true);
  });
});
