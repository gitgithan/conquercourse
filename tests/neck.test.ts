import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { parseClip, sampleClip } from '../src/motion/clip';
import { clipToWorld } from '../src/motion/pose';
import { NECK_LIMIT, SHOULDER_LIMIT, settleNeck } from '../src/motion/neck';

const run = parseClip(JSON.parse(readFileSync('public/assets/motion/run.json', 'utf8')));
const ix = (n: string) => run.names.indexOf(n);
const pose = (t: number) => {
  const j = sampleClip(run, t, true), hips = j[0];
  return j.map((p) => clipToWorld([p[0] - hips[0], p[1] - hips[1], p[2] - hips[2]]));
};
const rest = pose(0.3);
const angle = (v: Vector3) => Math.atan2(v.y, v.x);
const bend = (j: Vector3[], a: string, b: string) => {
  const d = angle(j[ix(b)].clone().sub(j[ix(a)])) - angle(rest[ix(b)].clone().sub(rest[ix(a)])) - (angle(j[ix('Chest')].clone().sub(j[0])) - angle(rest[ix('Chest')].clone().sub(rest[0])));
  return Math.abs(Math.atan2(Math.sin(d), Math.cos(d)));
};

describe('neck and shoulders while the body changes pose', () => {
  it('leaves a pose that is already fine alone', () => {
    const j = rest.map((p) => p.clone());
    settleNeck(j, rest, ix);
    j.forEach((p, i) => expect(p.distanceTo(rest[i])).toBeLessThan(1e-6));
  });
  it('brings a head thrown back (a folded pose blended into a hang) inside the neck limit, bones keep their length', () => {
    const j = rest.map((p) => p.clone());
    const back = new Vector3(-0.25, 0.05, 0); // the head and neck swung back behind the trunk
    for (const n of ['Neck2', 'Head', 'Jaw', 'LeftEye', 'RightEye']) j[ix(n)].add(back);
    expect(bend(j, 'Neck1', 'Neck2')).toBeGreaterThan(NECK_LIMIT);
    settleNeck(j, rest, ix);
    for (const [a, b] of [['Chest', 'Neck1'], ['Neck1', 'Neck2'], ['Neck2', 'Head']]) {
      expect(bend(j, a, b)).toBeLessThanOrEqual(NECK_LIMIT + 1e-6);
      expect(j[ix(b)].distanceTo(j[ix(a)])).toBeCloseTo(rest[ix(b)].distanceTo(rest[ix(a)]), 4);
    }
    expect(bend(j, 'Chest', 'Head')).toBeLessThanOrEqual(NECK_LIMIT + 1e-6);
  });
  it('pulls shoulders pushed forward back to within the limit, the arm following', () => {
    const j = rest.map((p) => p.clone());
    const fwd = new Vector3(0.2, 0, 0);
    for (const n of ['LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm', 'LeftHand', 'RightHand']) j[ix(n)].add(fwd);
    const elbow = j[ix('LeftForeArm')].clone().sub(j[ix('LeftArm')]);
    settleNeck(j, rest, ix);
    for (const side of ['Left', 'Right']) expect(j[ix(side + 'Arm')].distanceTo(rest[ix(side + 'Arm')])).toBeLessThanOrEqual(SHOULDER_LIMIT + 1e-6);
    expect(j[ix('LeftForeArm')].clone().sub(j[ix('LeftArm')]).distanceTo(elbow)).toBeLessThan(1e-6);
  });
  it('follows the trunk when it is turned (a hang is upright, a pull-up is tilted)', () => {
    const turned = rest.map((p) => p.clone().applyAxisAngle(new Vector3(0, 0, 1), 0.6));
    const j = turned.map((p) => p.clone());
    settleNeck(j, rest, ix);
    j.forEach((p, i) => expect(p.distanceTo(turned[i])).toBeLessThan(1e-6));
  });
});
