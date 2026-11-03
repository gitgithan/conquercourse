import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three/webgpu';
import { PHASE_FILES, clipDuration, loopDistance, parseClip, sampleClip, type Phase } from '../src/motion/clip';
import { clipToWorld, solveBones, type Rig } from '../src/motion/pose';
import { DemoMotion, legLength, type Clips } from '../src/motion/timeline';
import { loadClip } from './helpers/clips';

const load = loadClip;
const clips = Object.fromEntries((Object.keys(PHASE_FILES) as Phase[]).map((p) => [p, load(PHASE_FILES[p])])) as Clips;

describe('clip loader', () => {
  it('loads every shipped clip', () => {
    for (const c of Object.values(clips)) expect(c.names).toHaveLength(30);
  });
  it('asserts names length equals array length', () => {
    const bad = { ...clips.run, names: clips.run.names.slice(1) };
    expect(() => parseClip(bad)).toThrow(/differ in length/);
    const badFrame = { ...clips.run, frames: [clips.run.frames[0].slice(1), ...clips.run.frames.slice(1)] };
    expect(() => parseClip(badFrame)).toThrow(/joints/);
  });
});

describe('time-warp', () => {
  it('plays at the clip rate, loops a run and holds a leap', () => {
    const { run, leap } = clips;
    expect(sampleClip(run, clipDuration(run) * 2, true)[0]).toEqual(sampleClip(run, 0, true)[0]);
    expect(sampleClip(leap, 100, false)).toEqual(leap.frames[leap.frames.length - 1]);
    const mid = sampleClip(run, 0.5 / run.fps, true);
    expect(mid[0][2]).toBeCloseTo((run.frames[0][0][2] + run.frames[1][0][2]) / 2, 9);
  });
});

describe('posing', () => {
  // rest = clip frame 0 in game axes with every bone un-rotated; a posed frame must put each bone's joint on the clip's
  const run = clips.run;
  const toWorld = (f: number[][]) => f.map((p) => clipToWorld(p));
  const rest = toWorld(run.frames[0]);
  const rig: Rig = {
    rootQuat: new Quaternion(),
    bones: run.names.map((name, i) => ({ name, parent: run.parents[i], restPos: rest[i].clone(), restQuat: new Quaternion() })),
  };
  const forward = (local: Quaternion[], hips: Vector3): Vector3[] => {
    const wq: Quaternion[] = [];
    const wp: Vector3[] = [];
    rig.bones.forEach((b, i) => {
      const p = b.parent;
      wq[i] = p < 0 ? local[i].clone() : wq[p].clone().multiply(local[i]);
      wp[i] = p < 0 ? hips.clone() : wp[p].clone().add(rest[i].clone().sub(rest[p]).applyQuaternion(wq[p]));
    });
    return wp;
  };
  it('puts every bone on the clip joint it aims at (both ends of every bone)', () => {
    for (const f of [5, 14, 25, 33]) {
      const target = toWorld(run.frames[f]);
      const posed = forward(solveBones(rig, run.parents, run.names, target), target[0]);
      const worst = Math.max(...posed.map((p, i) => p.distanceTo(target[i])));
      expect(worst).toBeLessThan(0.05);
    }
  });
});

describe('the demo path', () => {
  const m = new DemoMotion(clips, 1);
  it('puts the hips exactly on the simulator path and draws the joints around them', () => {
    for (const tick of [0, 100, 300, 450, 480, 520, 600, 700]) {
      const pose = m.pose(tick);
      expect(pose.joints[0].x).toBeCloseTo(m.path(tick).x, 9);
      expect(pose.joints[0].y).toBeCloseTo(m.path(tick).y, 9);
      expect(pose.joints).toHaveLength(30);
    }
  });
  it('runs, leaps, lands and runs on, by tick alone', () => {
    expect([0, 419, 430, 520, 700].map((t) => m.phaseAt(t))).toEqual(['run', 'run', 'leap', 'land', 'run']);
    expect(m.pose(430)).toEqual(m.pose(430));
  });
  it('lifts the hips by the simulated arc in the air', () => {
    const grounded = m.path(419).y;
    const apex = Math.max(...Array.from({ length: 80 }, (_, i) => m.path(420 + i).y));
    expect(apex - grounded).toBeGreaterThan(0.3);
  });
  it('measures the legs', () => {
    const names = clips.run.names;
    expect(legLength(names, (i) => new Vector3(...clips.run.frames[0][i]))).toBeGreaterThan(0.7);
    expect(loopDistance(clips.run)).toBeGreaterThan(3);
  });
});
