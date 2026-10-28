import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { parseClip, sampleClip } from '../src/motion/clip';
import { clipToWorld } from '../src/motion/pose';
import { vaultPose, type VaultRig } from '../src/motion/vault-pose';
import { findVault, takeoffDistance, vaultAt, vaultHand } from '../src/sim/vault';

// The run clip gives the bone lengths and the running pose the vault starts and ends in (scale 1: the Rookie's scale only changes the metres).
const run = parseClip(JSON.parse(readFileSync('public/assets/motion/run.json', 'utf8')));
const names = run.names;
const ix = (n: string) => names.indexOf(n);
const f0 = run.frames[13];
const rig: VaultRig = { names, parents: run.parents, len: names.map((_, i) => (i === 0 ? 0 : Math.hypot(...f0[i].map((v, k) => v - f0[run.parents[i]][k])))) };
const base = (() => {
  const j = sampleClip(run, 0.3, true), hips = j[0], minY = Math.min(...j.map((p) => p[1]));
  return j.map((p) => clipToWorld([p[0] - hips[0], p[1] - hips[1], p[2] - hips[2]]).add(new Vector3(0, hips[1] - minY, 0)));
})();

// The real simulator's vault over a step: the plant, the feet's path and the contact point, as the actor gets them every tick.
const TOP = 1.0, VX = 7;
const terrain = { waterY: -1.5, platforms: [{ x0: -10, x1: 20, top: 0 }, { x0: 20, x1: 45, top: TOP }] };
const vault = findVault(terrain, 20 - takeoffDistance(VX, TOP), 0, VX)!;
const contactAt = (p: number) => {
  const q = vaultAt(vault, Math.round(p * vault.n)), c = vaultHand(vault);
  return { x: c.x - q.x, y: c.y - q.y };
};
const poseAt = (p: number) => vaultPose(rig, { progress: p, contact: contactAt(p), base });

describe('the vault pose (hands on the obstacle)', () => {
  it('starts and ends in the running pose, so nothing jumps at either end', () => {
    for (const p of [0, 1]) {
      const { joints } = poseAt(p);
      joints.forEach((q, i) => expect(q.distanceTo(base[i])).toBeLessThan(1e-6));
    }
  });
  it('while the hands are down, both hands are on the contact point within 3 cm', () => {
    let down = 0;
    for (let i = 0; i <= 200; i++) {
      const p = i / 200, o = poseAt(p), c = contactAt(p);
      if (o.handsDown < 0.99) continue;
      down++;
      for (const h of [o.hands.left, o.hands.right]) {
        expect(Math.hypot(h.x - c.x, h.y - c.y)).toBeLessThan(0.03);
      }
    }
    expect(down).toBeGreaterThan(200 * 0.15); // the hands are down for a good part of the vault, not a flash
  });
  it('the hands are down in the middle of the vault, not at the plant and not after the landing', () => {
    expect(poseAt(0.02).handsDown).toBeLessThan(0.05);
    expect(poseAt(0.75).handsDown).toBeGreaterThan(0.99);
    expect(poseAt(0.99).handsDown).toBeLessThan(0.05);
  });
  it('the arms reach for the top before the hands are down: the near hand is out toward the contact at the plant', () => {
    const o = poseAt(0.12), c = contactAt(0.12);
    const reachHand = o.hands.left.x > o.joints[ix('LeftArm')].x + 0.3; // out ahead of the shoulder
    expect(reachHand).toBe(true);
    expect(c.x).toBeGreaterThan(1.5);
  });
  it('the shoulders are over the hands and the body arcs over the step: the hips sit above the contact height with the arms as props', () => {
    const o = poseAt(0.75), c = contactAt(0.75);
    const sh = (o.joints[ix('LeftArm')].x + o.joints[ix('RightArm')].x) / 2;
    expect(Math.abs(sh - c.x)).toBeLessThan(0.6); // the shoulders are near over the hands
    expect(o.joints[ix('LeftArm')].y).toBeGreaterThan(c.y + 0.25); // and above them
    expect(o.joints[0].y).toBeGreaterThan(c.y); // the hips are lifted over the top surface
  });
  it('the head looks ahead: it is not turned down with the trunk', () => {
    const o = poseAt(0.55);
    const trunk = o.joints[ix('Chest')].clone().sub(o.joints[0]);
    const neck = o.joints[ix('Head')].clone().sub(o.joints[ix('Neck1')]);
    const lean = (v: Vector3) => Math.atan2(v.x, v.y);
    expect(lean(neck)).toBeLessThan(lean(trunk) - 0.3);
  });
  it('no joint moves more than 25 cm between two vault frames of 1/120 s (the pose is continuous)', () => {
    let prev = poseAt(0).joints;
    for (let i = 1; i <= 120; i++) {
      const cur = poseAt(i / 120).joints;
      cur.forEach((q, k) => expect(q.distanceTo(prev[k])).toBeLessThan(0.25));
      prev = cur;
    }
  });
});
