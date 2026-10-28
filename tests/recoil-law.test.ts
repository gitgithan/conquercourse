import { describe, expect, it } from 'vitest';
import { DEFAULT_CRATE, DEFAULT_RECOIL, ballSpeedFromRest, effectiveMuzzle, shot, standingPush, stepBall, type RecoilParams } from '../src/sim/recoil';
import { FLAT } from '../src/sim/terrain';

const P = (over: Partial<RecoilParams> = {}): RecoilParams => ({ ...DEFAULT_RECOIL, ...over });
const mom = (p: RecoilParams, v: number, dv: number, ballV: number) => p.charMass * (v + dv) + p.ballMass * ballV;

describe('recoil: momentum is conserved', () => {
  it('standing still: the runner and the ball end with equal and opposite momentum', () => {
    const p = P(), s = shot(p, 0, 0, false);
    expect(mom(p, 0, s.dvx, s.ballVx)).toBeCloseTo(0, 9);
    expect(s.dvx).toBeGreaterThan(0);
    expect(s.ballVx).toBeLessThan(0); // the ball goes backward
  });
  it('moving: the total momentum before equals the total after, whatever the speed', () => {
    const p = P({ ballMass: 9, muzzle: 22 });
    for (const v of [0, 3, 7.4, 11]) {
      const s = shot(p, v, 0, false);
      expect(mom(p, v, s.dvx, s.ballVx)).toBeCloseTo((p.charMass + p.ballMass) * v, 9);
    }
  });
  it('in the air both parts of the momentum are conserved, up and along', () => {
    const p = P({ angle: 0.5 }), vx = 8, vy = 2, s = shot(p, vx, vy, true);
    expect(p.charMass * (vx + s.dvx) + p.ballMass * s.ballVx).toBeCloseTo((p.charMass + p.ballMass) * vx, 9);
    expect(p.charMass * (vy + s.dvy) + p.ballMass * s.ballVy).toBeCloseTo((p.charMass + p.ballMass) * vy, 9);
    expect(s.dvy).toBeLessThan(0); // a ball thrown up and back pushes the runner down
  });
  it('on the ground the ground takes the upward part: only the forward push counts', () => {
    const s = shot(P({ angle: 0.5 }), 5, 0, false);
    expect(s.dvy).toBe(0);
    expect(s.dvx).toBeCloseTo(shot(P({ angle: 0 }), 5, 0, false).dvx * Math.cos(0.5), 9);
  });
});

describe('recoil: heavy and slow, or light and fast', () => {
  it('the push is the ball mass times its speed over the total mass', () => {
    const p = P({ ballMass: 12, muzzle: 30, charMass: 70 });
    expect(standingPush(p)).toBeCloseTo((12 * 30) / 82, 9);
  });
  it('a ball twice as heavy gives close to twice the push', () => {
    const one = standingPush(P({ ballMass: 6 })), two = standingPush(P({ ballMass: 12 }));
    expect(two / one).toBeGreaterThan(1.85);
    expect(two / one).toBeLessThan(2);
  });
  it('the same mass times speed gives nearly the same push', () => {
    const heavySlow = standingPush(P({ ballMass: 24, muzzle: 15 })), lightFast = standingPush(P({ ballMass: 12, muzzle: 30 }));
    expect(Math.abs(heavySlow - lightFast) / lightFast).toBeLessThan(0.18); // the total mass differs a little, so not exactly
  });
  it('the heavy ball goes slow and the light runner goes fast', () => {
    const p = P(), v = standingPush(p), vb = ballSpeedFromRest(p);
    expect(vb).toBeLessThan(p.muzzle); // slower against the ground than the muzzle speed
    expect(v).toBeGreaterThan(0);
    expect(p.ballMass * vb).toBeCloseTo(p.charMass * v, 9); // equal momentum
  });
  it('a heavier runner is pushed less by the same shot', () => {
    expect(standingPush(P({ charMass: 100 }))).toBeLessThan(standingPush(P({ charMass: 60 })));
  });
  it('the crate piece is the same law with a slower throw', () => {
    const p = P({ ...DEFAULT_CRATE }), s = shot(p, 0, 0, false);
    expect(mom(p, 0, s.dvx, s.ballVx)).toBeCloseTo(0, 9);
    expect(s.dvx).toBeCloseTo((25 * 6) / 95, 9);
  });
});

describe('recoil: energy', () => {
  const kinetic = (p: RecoilParams, v: number, s: ReturnType<typeof shot>) =>
    0.5 * p.charMass * ((v + s.dvx) ** 2 - v ** 2) + 0.5 * p.ballMass * (s.ballVx ** 2 - v ** 2);
  it('the energy the shot makes equals half the reduced mass times the muzzle speed squared, at any running speed', () => {
    const p = P(), mu = (p.charMass * p.ballMass) / (p.charMass + p.ballMass);
    for (const v of [0, 4, 9]) expect(kinetic(p, v, shot(p, v, 0, false))).toBeCloseTo(0.5 * mu * p.muzzle ** 2, 6);
  });
  it('a launcher with little stored energy cannot give more than it stores', () => {
    const p = P({ energy: 300 }), s = shot(p, 0, 0, false);
    expect(effectiveMuzzle(p)).toBeLessThan(p.muzzle);
    expect(kinetic(p, 0, s)).toBeLessThanOrEqual(300 + 1e-6);
    expect(kinetic(p, 0, s)).toBeCloseTo(300, 6); // it uses all it has
  });
  it('a launcher with plenty of energy is limited only by its muzzle speed', () => {
    expect(effectiveMuzzle(P({ energy: 1e6 }))).toBe(30);
  });
});

describe('recoil: the ball flies back and lands', () => {
  it('a ball thrown backward at 20 m/s from 1 m up lands on the flat ground behind the pad', () => {
    let b = { x: 10, y: 1, vx: -20 + 5, vy: 0, landed: false };
    for (let i = 0; i < 600 && !b.landed; i++) b = stepBall(b, FLAT);
    expect(b.landed).toBe(true);
    expect(b.x).toBeLessThan(10);
    expect(b.x).toBeCloseTo(10 - 15 * Math.sqrt((2 * 1) / 9.81), 0); // within half a metre: the ball stops at the end of the tick it lands in
  });
});
