import { describe, expect, it } from 'vitest';
import { DT, GRAVITY } from '../src/sim/units';
import {
  DEFAULT_DRONE, boardDrone, batteryJoules, canLiftOff, droneStep, hoverPower, hoverSeconds, leanAcceleration, maxLevelLean, maxPayload,
  rotorPower, softTouchdown, totalMass, weight, type DroneParams, type DroneState,
} from '../src/sim/drone';

const calm: DroneParams = { ...DEFAULT_DRONE, drag: 0, leanLag: 0.001, wind: 0 };
const flyFor = (s: DroneState, p: DroneParams, seconds: number, cmd = { lean: 0 as -1 | 0 | 1, climb: 0 as -1 | 0 | 1 }): DroneState => {
  let q = s;
  for (let i = 0; i < seconds * 120; i++) q = droneStep(q, cmd, p);
  return q;
};

describe('drone: thrust against weight', () => {
  it('hovers when the push equals the weight (net acceleration zero)', () => {
    const p = { ...calm, stabiliser: false };
    const s0 = { ...boardDrone(p, 0, 0), y: 10, throttle: weight(p) / p.maxThrust };
    const s1 = flyFor(s0, p, 3);
    expect(Math.abs(s1.vy)).toBeLessThan(1e-9);
    expect(Math.abs(s1.y - 10)).toBeLessThan(1e-9);
  });
  it('climbs with more push than weight and sinks with less', () => {
    const p = { ...calm, stabiliser: false };
    const base = { ...boardDrone(p, 0, 0), y: 10 };
    expect(flyFor({ ...base, throttle: 1.2 * weight(p) / p.maxThrust }, p, 1).vy).toBeGreaterThan(0);
    expect(flyFor({ ...base, throttle: 0.8 * weight(p) / p.maxThrust }, p, 1).vy).toBeLessThan(0);
  });
  it('the acceleration is (push - weight) / mass', () => {
    const p = { ...calm, stabiliser: false };
    const T = 1.25 * weight(p);
    const s = droneStep({ ...boardDrone(p, 0, 0), y: 10, throttle: T / p.maxThrust }, { lean: 0, climb: 0 }, p);
    expect(s.vy / DT).toBeCloseTo((T - weight(p)) / totalMass(p), 6);
  });
});

describe('drone: leaning', () => {
  it('a lean of a gives a sideways acceleration g tan a while the height is held', () => {
    const p = { ...calm };
    const s0 = { ...boardDrone(p, 0, 0), y: 10, hold: 10 };
    for (const a of [0.1, 0.3, 0.5]) {
      const q = { ...p, maxLean: a };
      const s = flyFor(s0, q, 2, { lean: 1, climb: 0 });
      expect(s.vx / 2).toBeCloseTo(leanAcceleration(a), 1); // the mean acceleration over two seconds (the lean builds up in a few milliseconds)
      expect(Math.abs(s.y - 10)).toBeLessThan(0.05); // the stabiliser held the height
    }
  });
  it('holding height at a lean needs more push: T = weight / cos(lean)', () => {
    const p = { ...calm, maxLean: 0.5 };
    const s = flyFor({ ...boardDrone(p, 0, 0), y: 10, hold: 10 }, p, 3, { lean: 1, climb: 0 });
    expect(s.thrust).toBeCloseTo(weight(p) / Math.cos(0.5), 0);
  });
  it('without the stabiliser a lean makes the drone sink (the vertical push shrinks)', () => {
    const p = { ...calm, stabiliser: false };
    const s = flyFor({ ...boardDrone(p, 0, 0), y: 50, throttle: weight(p) / p.maxThrust }, p, 1, { lean: 1, climb: 0 });
    expect(s.vy).toBeLessThan(-1);
  });
  it('a lean beyond the steepest level lean cannot hold the height', () => {
    const p = { ...calm, maxLean: 1.2 };
    expect(maxLevelLean(p)).toBeLessThan(1.2);
    const s = flyFor({ ...boardDrone(p, 0, 0), y: 50, hold: 50 }, p, 3, { lean: 1, climb: 0 });
    expect(s.y).toBeLessThan(50 - 0.5);
  });
});

describe('drone: the payload limit', () => {
  it('a rider above the limit cannot lift off, one below it can', () => {
    const lim = maxPayload(DEFAULT_DRONE);
    expect(lim).toBeGreaterThan(150);
    expect(canLiftOff({ ...DEFAULT_DRONE, payload: lim - 2 })).toBe(true);
    expect(canLiftOff({ ...DEFAULT_DRONE, payload: lim + 5 })).toBe(false);
    const p = { ...DEFAULT_DRONE, payload: lim + 20, drag: 0 };
    const s = flyFor(boardDrone(p, 0, 0), p, 3);
    expect(s.y).toBeLessThanOrEqual(boardDrone(p, 0, 0).y + 0.01); // never climbs above where it started
  });
  it('a heavier rider leaves less room to lean', () => {
    expect(maxLevelLean({ ...DEFAULT_DRONE, payload: 150 })).toBeLessThan(maxLevelLean({ ...DEFAULT_DRONE, payload: 70 }));
  });
});

describe('drone: the battery', () => {
  it('the energy used equals the sum of power times time', () => {
    const p = { ...DEFAULT_DRONE, battery: 500 };
    let s = { ...boardDrone(p, 0, 0), y: 10, hold: 10 }, sum = 0;
    const e0 = s.energy;
    for (let i = 0; i < 600; i++) { s = droneStep(s, { lean: i < 300 ? 1 : 0, climb: 0 }, p); sum += s.power * DT; }
    expect(e0 - s.energy).toBeCloseTo(sum, 6);
  });
  it('hover power follows the rotor law: thrust to the power 1.5, so a heavier drone pays more than its weight ratio', () => {
    const a = hoverPower({ ...DEFAULT_DRONE, avionics: 0, payload: 70 }), b = hoverPower({ ...DEFAULT_DRONE, avionics: 0, payload: 70 + 155 });
    const ratio = weight({ ...DEFAULT_DRONE, payload: 225 }) / weight(DEFAULT_DRONE);
    expect(b / a).toBeCloseTo(Math.pow(ratio, 1.5), 6);
    expect(b / a).toBeGreaterThan(ratio);
  });
  it('the demo pack hovers about ten seconds and then the drone falls', () => {
    expect(hoverSeconds(DEFAULT_DRONE)).toBeGreaterThan(8);
    expect(hoverSeconds(DEFAULT_DRONE)).toBeLessThan(13);
    const p = { ...DEFAULT_DRONE, battery: 10 };
    let s = { ...boardDrone(p, 0, 0), y: 30, hold: 30 };
    let t = 0;
    while (!s.empty && t < 60) { s = droneStep(s, { lean: 0, climb: 0 }, p); t += DT; }
    expect(s.empty).toBe(true);
    const fall = flyFor(s, p, 1);
    expect(fall.vy).toBeLessThan(-3); // no push: it falls
    expect(fall.thrust).toBe(0);
  });
  it('the numbers in the design note hold', () => {
    expect(weight(DEFAULT_DRONE)).toBeCloseTo(1520.6, 0);
    expect(rotorPower(weight(DEFAULT_DRONE), DEFAULT_DRONE)).toBeGreaterThan(16000);
    expect(rotorPower(weight(DEFAULT_DRONE), DEFAULT_DRONE)).toBeLessThan(18000);
    expect(batteryJoules(DEFAULT_DRONE)).toBe(180000);
  });
});

describe('drone: drag and wind', () => {
  it('drag stops the drone speeding up for ever (a top speed)', () => {
    const p = { ...DEFAULT_DRONE, maxLean: 0.5 };
    const s = flyFor({ ...boardDrone(p, 0, 0), y: 10, hold: 10, energy: 1e12 }, p, 30, { lean: 1, climb: 0 });
    expect(s.vx).toBeLessThan(leanAcceleration(0.5) / p.drag + 0.1);
    expect(s.vx).toBeGreaterThan(10);
  });
  it('a gust pushes the drone sideways', () => {
    const calmFlight = flyFor({ ...boardDrone(DEFAULT_DRONE, 0, 0), y: 10, hold: 10 }, DEFAULT_DRONE, 3);
    const windy = flyFor({ ...boardDrone(DEFAULT_DRONE, 0, 0), y: 10, hold: 10 }, { ...DEFAULT_DRONE, wind: 2 }, 3);
    expect(Math.abs(windy.x - calmFlight.x)).toBeGreaterThan(0.5);
  });
});

describe('drone: touching down', () => {
  it('slow and level is soft; fast or tilted is not', () => {
    const s = boardDrone(DEFAULT_DRONE, 0, 0);
    expect(softTouchdown({ ...s, vy: -1, vx: 3, lean: 0.1 })).toBe(true);
    expect(softTouchdown({ ...s, vy: -4 })).toBe(false);
    expect(softTouchdown({ ...s, vx: 12 })).toBe(false);
    expect(softTouchdown({ ...s, lean: 0.6 })).toBe(false);
    expect(GRAVITY).toBeCloseTo(9.81, 2);
  });
});
